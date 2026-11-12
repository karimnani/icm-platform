import test from 'node:test';
import assert from 'node:assert/strict';
import { makeD1 } from './d1shim.js';
import { createD1Repository } from '../src/adapters/outbound/d1/d1Repository.js';
import { createD1Catalog } from '../src/adapters/outbound/d1/d1Catalog.js';
import { createApiHandler } from '../src/adapters/inbound/http/apiHandler.js';
import * as webCrypto from '../src/adapters/outbound/cloudflare/webCrypto.js';
import { createRouter } from '../src/adapters/inbound/http/router.js';
import { createHttpHandlers } from '../src/adapters/inbound/http/handlers.js';

const PW = 'Changeme!2026';
function setup() {
  const db = makeD1();
  const api = createApiHandler({ repo: createD1Repository({ db }), crypto: webCrypto, secret: 'test-secret' });
  const noop = async () => { throw new Error('non utilisé'); };
  const router = createRouter(createHttpHandlers({ ingestDocument: noop, listDocuments: noop, deleteDocument: noop, purgeProject: noop, askQuestion: noop, api }));
  const call = async (method, path, body, token) => {
    const res = await router(new Request('https://w.test' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }));
    return { status: res.status, ...(await res.json()) };
  };
  const login = async (email) => (await call('POST', '/api/login', { email, password: PW })).token;
  return { db, call, login };
}

test('mots de passe : le hash du seed (généré par Python) est vérifié par WebCrypto ; jeton falsifié refusé', async () => {
  const { db } = setup();
  const u = db.sqlite.prepare("SELECT password_hash FROM user WHERE login = 'admin'").get();
  assert.equal(await webCrypto.verifyPassword(PW, u.password_hash), true);
  assert.equal(await webCrypto.verifyPassword('autre', u.password_hash), false);
  const t = await webCrypto.signToken({ uid: 'x' }, 's');
  assert.equal((await webCrypto.verifyToken(t, 's')).uid, 'x');
  assert.equal(await webCrypto.verifyToken(t, 'autre'), null);
  assert.equal(await webCrypto.verifyToken(t.slice(0, -2) + 'AA', 's'), null);
  assert.equal(await webCrypto.verifyToken(await webCrypto.signToken({ uid: 'x' }, 's', -10), 's'), null);
});

test('login : succès, échec journalisé, route protégée sans jeton', async () => {
  const { call, db } = setup();
  assert.equal((await call('GET', '/api/projets/lyon/bootstrap')).status, 401);
  const bad = await call('POST', '/api/login', { email: 'admin@usine-lyon.fr', password: 'faux' });
  assert.equal(bad.status, 401);
  const ok = await call('POST', '/api/login', { email: 'admin@usine-lyon.fr', password: PW });
  assert.equal(ok.status, 200); assert.deepEqual(ok.projets.map((p) => [p.id, p.role]), [['lyon', 'Admin']]);
  assert.deepEqual(db.sqlite.prepare('SELECT status FROM log ORDER BY rowid').all().map((r) => r.status), ['Échec', 'Succès']);
});

test('droits : technicien lit son projet mais ne peut pas modifier l’arborescence ; pas d’accès à un autre projet', async () => {
  const { call, login } = setup(), tech = await login('p.durand@usine-lyon.fr');
  assert.equal((await call('GET', '/api/projets/lyon/bootstrap', null, tech)).role, 'Technicien');
  assert.equal((await call('GET', '/api/projets/grenoble/bootstrap', null, tech)).status, 403);
  assert.equal((await call('POST', '/api/projets/lyon/noeuds', { type: 'Site', nom: 'X' }, tech)).status, 403);
});

test('arborescence : création hiérarchique, validation du parent, suppression refusée si rattachements', async () => {
  const { call, login, db } = setup(), adm = await login('admin@usine-lyon.fr');
  const mk = async (type, nom, parent_id) => (await call('POST', '/api/projets/lyon/noeuds', { type, nom, parent_id }, adm));
  const s = await mk('Site', 'Site Saint-Priest'), a = await mk('Atelier', 'Conditionnement', s.id), l = await mk('Ligne de production', 'Ligne 2', a.id), m = await mk('Machine', 'Convoyeur C-3', l.id);
  assert.equal((await mk('Machine', 'Orpheline', s.id)).status, 422, 'une machine ne se place pas sous un site');
  const b = await call('GET', '/api/projets/lyon/bootstrap', null, adm);
  assert.equal(b.tree[0].kids[0].kids[0].kids[0].n, 'Convoyeur C-3');
  assert.equal((await call('GET', '/api/projets/grenoble/bootstrap', null, adm)).status, 403);
  await call('PATCH', `/api/projets/lyon/noeuds/${m.id}`, { nom: 'Convoyeur C-3B' }, adm);
  const rep = await call('POST', '/api/projets/lyon/interventions', { machine_id: m.id, date: '2026-10-16', probleme: 'Bruit', diagnostic: 'Roulement', actions: 'Remplacé', etat_final: 'Remis en service', duree: 1.5 }, adm);
  assert.match(rep.reference, /^INT-0142$/);
  const del = await call('DELETE', `/api/projets/lyon/noeuds/${s.id}`, null, adm);
  assert.equal(del.status, 409); assert.match(del.error, /1 intervention/);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM machine').get().n, 1, 'rien n’a été supprimé');
  const b2 = await call('GET', '/api/projets/lyon/bootstrap', null, adm);
  assert.deepEqual([b2.reports[0].reference, b2.reports[0].auteur, b2.reports[0].duree], ['INT-0142', 'admin', 1.5]);
  assert.equal((await call('POST', '/api/projets/lyon/interventions', { machine_id: s.id, date: '2026-10-16', probleme: 'x', diagnostic: 'x', actions: 'x', etat_final: 'x' }, adm)).status, 422);
  const rep2 = await call('POST', '/api/projets/lyon/interventions', { machine_id: m.id, date: '2026-10-17', probleme: 'x', diagnostic: 'x', actions: 'x', etat_final: 'x' }, adm);
  assert.equal(rep2.reference, 'INT-0143');
});

test('catalogue RAG sur D1 : ingestion, nouvelle version, liste, suppression ; document visible dans l’API', async () => {
  const { call, login, db } = setup(), adm = await login('admin@usine-lyon.fr'), cat = createD1Catalog({ db });
  await cat.save('lyon', { id: 'abc123', name: 'Procédure pompe P-12.pdf', ver: '1', chunks: 12, chars: 9000, date: '16/10/2026' });
  await cat.save('lyon', { id: 'abc123', name: 'Procédure pompe P-12.pdf', ver: '2', chunks: 14, chars: 9500, date: '16/10/2026' });
  await cat.save('lyon', { id: 'abc123', name: 'Procédure pompe P-12.pdf', ver: '2', chunks: 15, chars: 9600, date: '16/10/2026' });
  const list = await cat.list('lyon');
  assert.equal(list.length, 1); assert.deepEqual([list[0].ver, list[0].chunks, list[0].name], ['2', 15, 'Procédure pompe P-12.pdf']);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM document_version').get().n, 2);
  await assert.rejects(cat.save('inconnu', { id: 'z', name: 'z', ver: '1', chunks: 1, chars: 1 }), /inconnu/);
  const b = await call('GET', '/api/projets/lyon/bootstrap', null, adm);
  assert.deepEqual([b.docs[0].titre, b.docs[0].numero, b.docs[0].qualification, b.docs[0].type], ['Procédure pompe P-12.pdf', 2, 'indexe', 'Document général de maintenance']);
  const v = await call('POST', '/api/projets/lyon/documents/abc123/versions', { note: 'graissage passé à 500 h' }, adm);
  assert.equal(v.version, 3);
  const site = await call('POST', '/api/projets/lyon/noeuds', { type: 'Site', nom: 'S1' }, adm);
  assert.equal((await call('PATCH', '/api/projets/lyon/documents/abc123', { type: 'Gammes opératoires', node_id: site.id }, adm)).status, 200);
  const b3 = await call('GET', '/api/projets/lyon/bootstrap', null, adm);
  assert.deepEqual([b3.docs[0].type, b3.docs[0].node], ['Gammes opératoires', site.id]);
  assert.equal((await call('PATCH', '/api/projets/lyon/documents/abc123', { type: 'Inexistant' }, adm)).status, 422);
  await cat.remove('lyon', 'abc123');
  assert.deepEqual(await cat.list('lyon'), []);
  assert.deepEqual(await cat.listDocumentIds('lyon'), []);
});

test('validation des connaissances : décision tracée, document qualifié « valide », rejet sans effet sur le document', async () => {
  const { call, login, db } = setup(), adm = await login('admin@usine-lyon.fr'), tech = await login('p.durand@usine-lyon.fr');
  await createD1Catalog({ db }).save('lyon', { id: 'doc1', name: 'P12.pdf', ver: '1', chunks: 1, chars: 1 });
  const vid = db.sqlite.prepare('SELECT id FROM document_version').get().id;
  db.sqlite.prepare("INSERT INTO connaissance (id, sujet, relation, objet, interpretation_ia, texte_valide, page, document_version_id) VALUES ('k1','Pompe P-12','utilise','Graisse EP2','interp','texte',4,?)").run(vid);
  db.sqlite.prepare("INSERT INTO connaissance (id, sujet, relation, objet, document_version_id) VALUES ('k2','A','r','B',?)").run(vid);
  assert.equal((await call('POST', '/api/projets/lyon/connaissances/k1/decision', { statut: 'validee' }, tech)).status, 403);
  assert.equal((await call('POST', '/api/projets/lyon/connaissances/k2/decision', { statut: 'rejetee' }, adm)).status, 422, 'rejet sans motif refusé (décision auditable)');
  assert.equal((await call('POST', '/api/projets/lyon/connaissances/k2/decision', { statut: 'rejetee', motif: 'Doublon de k1' }, adm)).status, 200);
  assert.equal(db.sqlite.prepare("SELECT motif FROM decision WHERE connaissance_id = 'k2'").get().motif, 'Doublon de k1');
  assert.equal(db.sqlite.prepare("SELECT qualification q FROM document").get().q, 'indexe');
  assert.equal((await call('POST', '/api/projets/lyon/connaissances/k1/decision', { statut: 'corrigee', corrections: { sujet: 'Pompe P-12', relation: 'nécessite', objet: 'Graisse EP2', texte_valide: 'Corrigé' } }, adm)).status, 200);
  assert.equal(db.sqlite.prepare("SELECT qualification q FROM document").get().q, 'valide');
  const b = await call('GET', '/api/projets/lyon/bootstrap', null, adm);
  assert.deepEqual(b.know.map((k) => [k.id, k.statut, k.relation]), [['k1', 'corrigee', 'nécessite'], ['k2', 'rejetee', 'r']]);
  assert.equal(b.decisions.length, 2); assert.equal(b.decisions[0].login, 'admin');
  assert.ok(b.logs.some((l) => l.action === 'Correction' && l.login === 'admin'));
});

test('comptes : création (mot de passe temporaire utilisable), désactivation, dernier admin protégé', async () => {
  const { call, login, db } = setup(), adm = await login('admin@usine-lyon.fr');
  const c = await call('POST', '/api/projets/lyon/users', { email: 'Nouveau@usine-lyon.fr', role: 'Technicien' }, adm);
  assert.equal(c.status, 201);
  assert.equal((await call('POST', '/api/login', { email: 'nouveau@usine-lyon.fr', password: c.motDePasseTemporaire })).status, 200);
  assert.equal((await call('POST', '/api/projets/lyon/users', { email: 'pas-un-mail', role: 'Technicien' }, adm)).status, 400);
  const id = db.sqlite.prepare("SELECT id FROM user WHERE email = 'nouveau@usine-lyon.fr'").get().id;
  await call('PATCH', `/api/projets/lyon/users/${id}`, { is_active: false }, adm);
  assert.equal((await call('POST', '/api/login', { email: 'nouveau@usine-lyon.fr', password: c.motDePasseTemporaire })).status, 401);
  assert.equal((await call('PATCH', '/api/projets/lyon/users/u-admin-lyon', { role: 'Technicien' }, adm)).status, 409);
});

test('projets : création (slug unique = espace Vectorize) et import d’arborescence', async () => {
  const { call, login } = setup(), adm = await login('admin@usine-lyon.fr');
  const p = await call('POST', '/api/projets', { nom: 'Usine de Nantes' }, adm);
  assert.equal(p.projet.id, 'usine-de-nantes');
  assert.equal((await call('POST', '/api/projets', { nom: 'Usine de Nantes' }, adm)).projet.id, 'usine-de-nantes-2');
  const imp = await call('POST', '/api/projets/usine-de-nantes/arborescence', { tree: [{ n: 'Site principal', t: 'Site', kids: [{ n: 'Atelier A', t: 'Atelier', kids: [{ n: 'Ligne A1', t: 'Ligne de production', kids: [{ n: 'Machine A-01', t: 'Machine' }] }] }] }] }, adm);
  assert.equal(imp.count, 4);
  assert.equal((await call('GET', '/api/me', null, adm)).projets.length, 3);
});
