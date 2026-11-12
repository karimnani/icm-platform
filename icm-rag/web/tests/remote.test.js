/**
 * Bout en bout : le client du front (api.js + remote.js) est branché sur le VRAI routeur + API du Worker,
 * lui-même sur de VRAI SQL (SQLite en mémoire qui imite D1). Seuls Workers AI / Vectorize sont absents.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from '../../worker/tests/d1shim.js';
import { createD1Repository } from '../../worker/src/adapters/outbound/d1/d1Repository.js';
import { createD1Catalog } from '../../worker/src/adapters/outbound/d1/d1Catalog.js';
import { createApiHandler } from '../../worker/src/adapters/inbound/http/apiHandler.js';
import * as webCrypto from '../../worker/src/adapters/outbound/cloudflare/webCrypto.js';
import { createRouter } from '../../worker/src/adapters/inbound/http/router.js';
import { createHttpHandlers } from '../../worker/src/adapters/inbound/http/handlers.js';
import { fmtDate, fmtDateTime, formatOf, mapKnowledge } from '../src/core/mapping.js';

const db = makeD1();
const noop = async () => { throw new Error('non utilisé'); };
const router = createRouter(createHttpHandlers({ ingestDocument: noop, listDocuments: noop, deleteDocument: noop, purgeProject: noop, askQuestion: noop,
  api: createApiHandler({ repo: createD1Repository({ db }), crypto: webCrypto, secret: 's' }) }));
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
globalThis.location = { hash: '' };
globalThis.fetch = (url, init) => router(new Request(url, init));

const { S } = await import('../src/core/state.js');
const { D } = await import('../src/core/projectData.js');
const R = await import('../src/core/remote.js');
const { api } = await import('../src/core/api.js');
const render = () => {};

test('mapping : dates SQLite (UTC), formats, historique de décisions', () => {
  assert.equal(fmtDate('2026-10-16'), '16/10/2026');
  assert.match(fmtDateTime('2026-10-16 08:05:00'), /^16\/10\/2026 \d\d:05$/);
  assert.deepEqual(['a.pdf', 'b.DOCX', 'c.xlsx', 'd.jpg', 'e'].map(formatOf), ['PDF', 'Word', 'Excel', 'Image', 'E']);
  const k = mapKnowledge([{ id: 'k1', sujet: 'A', relation: 'r', objet: 'B', doc: 'd.pdf', ver: 3, page: null, statut: 'validee' }], [{ connaissance_id: 'k1', nouveau_statut: 'validee', created_at: '2026-10-13 12:00:00', login: 'admin' }]);
  assert.deepEqual([k[0].id, k[0].rid, k[0].page, k[0].h], [1, 'k1', 1, ['13/10/2026 · Validée par admin']]);
});

test('connexion refusée : message d’erreur, aucune session', async () => {
  await R.doLogin('admin@usine-lyon.fr', 'mauvais', render);
  assert.equal(S.role, null); assert.match(S.loginErr, /incorrect/); assert.equal(R.hasToken(), false);
});

test('connexion + chargement du projet depuis D1 ; écritures puis rechargement', async () => {
  await R.doLogin('admin@usine-lyon.fr', 'Changeme!2026', render);
  assert.equal(S.loginErr, ''); assert.equal(S.role, 'admin'); assert.equal(S.project, 'lyon'); assert.equal(S.userMail, 'admin@usine-lyon.fr');
  assert.deepEqual(S.projects.map((p) => p.n), ['Usine de Lyon']); assert.equal(location.hash, 'projets');   // le navigateur ajoute le « # »
  assert.deepEqual(D().tree, [], 'les données de démonstration ne sont plus utilisées');

  await R.mutate(() => api.addNode('lyon', { type: 'Site', nom: 'Site Saint-Priest' }), render, { after: (r) => { D().treeSel = r.id; } });
  const site = D().tree[0];
  assert.equal(D().treeSel, site.id);
  await R.mutate(() => api.addNode('lyon', { type: 'Atelier', nom: 'Conditionnement', parent_id: site.id }), render);
  await R.mutate(() => api.addNode('lyon', { type: 'Machine', nom: 'Orpheline', parent_id: site.id }), render);
  assert.match(S.err, /Ligne de production|Atelier|Site/, 'erreur serveur affichée dans le bandeau');
  S.err = '';

  const a = D().tree[0].kids[0];
  await R.mutate(() => api.addNode('lyon', { type: 'Ligne de production', nom: 'Ligne 2', parent_id: a.id }), render);
  const l = D().tree[0].kids[0].kids[0];
  await R.mutate(() => api.addNode('lyon', { type: 'Machine', nom: 'Convoyeur C-3', parent_id: l.id }), render);
  const m = l.id && D().tree[0].kids[0].kids[0].kids[0];
  assert.equal(m.n, 'Convoyeur C-3');

  let saved = '';
  await R.mutate(() => api.createIntervention('lyon', { machine_id: m.id, date: '2026-10-16', probleme: 'Bruit', diagnostic: 'Roulement', actions: 'Remplacé', etat_final: 'OK', duree: 1.5 }), render, { after: (r) => { saved = r.reference; } });
  assert.equal(saved, 'INT-0142');
  assert.deepEqual([D().crs[0].id, D().crs[0].m, D().crs[0].by, D().crs[0].h], ['INT-0142', m.id, 'admin', 1.5]);
  assert.ok(D().hist.some((h) => h[1] === 'Intervention' && h[4] === 'admin'), 'historique alimenté par le journal D1');
  assert.ok(D().logs.some((x) => x[3] === 'Connexion' && x[5] === 'Succès'));

  await R.mutate(() => api.deleteNode('lyon', site.id), render, { errKey: 'treeMsg' });
  assert.match(S.treeMsg, /1 intervention/, 'suppression refusée, message du Worker repris tel quel');
});

test('ingestion RAG → document visible dans l’écran Documents ; validation d’une connaissance ; comptes', async () => {
  await createD1Catalog({ db }).save('lyon', { id: 'h1', name: 'Procédure pompe P-12.pdf', ver: '1', chunks: 3, chars: 900 });
  const vid = db.sqlite.prepare('SELECT id FROM document_version').get().id;
  db.sqlite.prepare("INSERT INTO connaissance (id, sujet, relation, objet, interpretation_ia, texte_valide, page, document_version_id) VALUES ('k1','Pompe P-12','utilise','Graisse EP2','interp','texte',4,?)").run(vid);
  await R.hydrate('lyon');
  const d = D();
  assert.deepEqual([d.docs[0].n, d.docs[0].v, d.docs[0].f, d.docs[0].q, d.docs[0].node], ['Procédure pompe P-12.pdf', 1, 'PDF', 'indexe', null]);
  assert.equal(d.valSel, 1); assert.equal(d.val[0].st, 'attente');

  await R.mutate(() => api.decide('lyon', d.val[0].rid, { statut: 'validee' }), render);
  assert.equal(D().val[0].st, 'validee'); assert.equal(D().docs[0].q, 'valide'); assert.match(D().val[0].h[0], /Validée par admin/);

  await R.mutate(() => api.addVersion('lyon', d.docs[0].id, 'graissage passé à 500 h'), render);
  assert.deepEqual([D().docs[0].v, D().docs[0].q, D().docs[0].chg], [2, 'indexe', 'graissage passé à 500 h']);

  await R.mutate(() => api.createUser('lyon', 'x.y@usine-lyon.fr', 'Technicien'), render);
  const u = S.acc.users.find((x) => x.m === 'x.y@usine-lyon.fr');
  assert.deepEqual([u.r, u.p, u.l, u.a], ['Technicien', 'Usine de Lyon', 'Jamais', true]);
  await R.mutate(() => api.patchUser('lyon', u.id, { is_active: false }), render);
  assert.equal(S.acc.users.find((x) => x.m === u.m).a, false);
});

test('technicien : accès limité, déconnexion vide la mémoire ; session restaurée depuis le jeton', async () => {
  R.logout();
  await R.doLogin('p.durand@usine-lyon.fr', 'Changeme!2026', render);
  assert.equal(S.role, 'technicien'); assert.deepEqual(S.acc.users, []);
  await R.mutate(() => api.addNode('lyon', { type: 'Site', nom: 'Interdit' }), render);
  assert.match(S.err, /administrateurs/);
  S.err = ''; S.role = null;
  await R.restoreSession();
  assert.equal(S.role, 'technicien'); assert.equal(S.userMail, 'p.durand@usine-lyon.fr');
  R.logout(); assert.equal(R.hasToken(), false);
  await assert.rejects(api.me(), /Session expirée/);
});
