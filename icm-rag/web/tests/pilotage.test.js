/**
 * Pilotage & gouvernance, de bout en bout : le client du front (api, remote, assistant, indicateurs) est branché sur le VRAI routeur + API
 * du Worker, sur du VRAI SQL. Seuls Workers AI / Vectorize sont remplacés par des faux.
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
import { makeAskQuestion } from '../../worker/src/application/use-cases/askQuestion.js';
import { documentHash } from '../../worker/src/domain/text/identifiers.js';
import { settings } from '../../worker/src/config/constants.js';

const db = makeD1();
const hits = [{ score: 0.9, metadata: { doc: 'Procédure P-12.pdf', ver: '1', sec: '3. Graissage', text: 'Graisser toutes les 500 heures' } }];
const askQuestion = makeAskQuestion({ embedder: { embed: async (t) => t.map(() => [1]) }, vectorStore: { query: async () => hits }, llm: { generate: async () => 'Toutes les 500 h.' }, settings });
const noop = async () => { throw new Error('non utilisé'); };
const router = createRouter(createHttpHandlers({ ingestDocument: noop, listDocuments: noop, deleteDocument: noop, purgeProject: noop, askQuestion: noop,
  api: createApiHandler({ repo: createD1Repository({ db }), crypto: webCrypto, secret: 's', askQuestion }) }));
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
globalThis.location = { hash: '' };
globalThis.fetch = (url, init) => router(new Request(url, init));
globalThis.confirm = () => true;

const { S } = await import('../src/core/state.js');
const { D } = await import('../src/core/projectData.js');
const R = await import('../src/core/remote.js');
const { api, getToken } = await import('../src/core/api.js');
const { createAssistant } = await import('../src/features/assistant/conversation.js');
const { createWorkerChatGateway } = await import('../src/features/assistant/adapters/workerChatGateway.js');
const A = await import('../src/features/assistant/actions.js');
const I = await import('../src/features/indicators/actions.js');
const V = await import('../src/features/validation/actions.js');
const { mapConversations } = await import('../src/core/mapping.js');
const { treeFromRows, parseCsv } = await import('../src/core/treeImport.js');
const { toCsv } = await import('../src/core/download.js');
const { rejectReason } = await import('../src/features/integration/uploader.js');
const { pages } = await import('../src/app/registry.js');
const render = () => {};
function document_val(id, v) { globalThis.document = { getElementById: (i) => (i === id ? { value: v } : null) }; }
document_val('', '');

test('séquence complète : question → conversation enregistrée → évaluation → indicateurs → traitement du signalement', async () => {
  await createD1Catalog({ db }).save('lyon', { id: await documentHash('lyon', 'Procédure P-12.pdf'), name: 'Procédure P-12.pdf', ver: '1', chunks: 1, chars: 30 });
  await R.doLogin('p.durand@usine-lyon.fr', 'Changeme!2026', render);
  assert.equal(S.userLogin, 'p.durand');
  const assistant = createAssistant({ gateway: createWorkerChatGateway({ getBaseUrl: () => 'https://w.test', getToken }) });
  await assistant.ask('Quelle fréquence de graissage ?');
  const conv = D().convs[0], answer = conv.msgs[1];
  assert.equal(answer.t, 'Toutes les 500 h.'); assert.ok(answer.mid, 'réponse rattachée à la conversation enregistrée'); assert.ok(conv.sid);
  assert.deepEqual(answer.src[0].slice(0, 3), ['Procédure P-12.pdf', 1, '3. Graissage']);

  // évaluation insatisfaisante enregistrée côté serveur (plus de « trou noir »)
  D().fb[answer.id] = { e: 'Partiellement', m: 'Information incomplète' };
  A.actions.fbsend({ b: { dataset: { id: answer.id } }, d: D(), render });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(D().fb[answer.id].sent, true);
  assert.equal(db.sqlite.prepare('SELECT niveau_utile n, message_id m FROM note').get().m, answer.mid);

  // l'historique survit au rechargement
  const { convs, fb } = mapConversations((await api.discussions('lyon')).discussions);
  assert.equal(convs[0].msgs.length, 2); assert.equal(fb[answer.mid].e, 'Partiellement');

  // côté administrateur : indicateurs + file de signalements
  R.logout(); await R.doLogin('admin@usine-lyon.fr', 'Changeme!2026', render);
  S.ind.per = '30'; S.ind.key = '';
  await new Promise((resolve) => I.loadIndicators(() => resolve()));
  const x = S.ind.data;
  assert.deepEqual([x.questions, x.evaluations.partielle, x.signalements_a_analyser], [1, 1, 1]);
  assert.equal(S.ind.key, 'lyon|30', 'chargé une seule fois');
  I.loadIndicators(() => { throw new Error('ne doit pas recharger'); });
  const html = pages.indicateurs();
  assert.match(html, /Indicateurs de pilotage/); assert.match(html, /Quelle fréquence de graissage/); assert.match(html, /Information incomplète/);
  S.ind.treat = x.signalements[0].id;
  assert.match(pages.indicateurs(), /Marquer corrigé/);
  document_val('indc', 'Source v2 publiée');
  I.actions.indset({ v: 'Corrigé', render });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(S.ind.key, '', 'rechargement demandé après traitement');
  await new Promise((resolve) => I.loadIndicators(() => resolve()));
  assert.equal(S.ind.data.signalements[0].statut_suivi, 'Corrigé');
});

test('validation : « Rejeter » ouvre la saisie du motif ; sans motif rien n’est envoyé ; avec motif la décision est tracée', async () => {
  const vid = db.sqlite.prepare('SELECT id FROM document_version LIMIT 1').get().id;
  db.sqlite.prepare("INSERT INTO connaissance (id, sujet, relation, objet, document_version_id) VALUES ('kr','A','r','B',?)").run(vid);
  await R.hydrate('lyon'); const d = D(); d.valSel = d.val.find((k) => k.rid === 'kr').id;
  V.actions.decide({ v: 'rejetee', render });
  assert.equal(S.val.rejecting, true); assert.equal(db.sqlite.prepare("SELECT statut s FROM connaissance WHERE id = 'kr'").get().s, 'attente');
  assert.match(pages.validation(), /Motif du rejet/);
  document_val('rm', '   ');
  V.actions.rejconfirm({ render }); assert.match(S.val.err, /motif/);
  document_val('rm', 'Doublon');
  V.actions.rejconfirm({ render }); await new Promise((r) => setTimeout(r, 80));
  assert.equal(db.sqlite.prepare("SELECT statut s FROM connaissance WHERE id = 'kr'").get().s, 'rejetee');
  await R.hydrate('lyon'); assert.match(D().val.find((k) => k.rid === 'kr').h.join(' '), /motif : Doublon/);
});

test('mutate : une écriture à la fois (le double-clic ne crée pas deux interventions)', async () => {
  const mk = async (type, nom, parent_id) => { let id; await R.mutate(() => api.addNode('lyon', { type, nom, parent_id }), render, { after: (r) => { id = r.id; } }); return id; };
  const m = await mk('Machine', 'M', await mk('Ligne de production', 'L', await mk('Atelier', 'A', await mk('Site', 'S'))));
  const body = { machine_id: m, date: '2026-10-16', probleme: 'p', diagnostic: 'd', actions: 'a', etat_final: 'ok' };
  await Promise.all([R.mutate(() => api.createIntervention('lyon', body), render), R.mutate(() => api.createIntervention('lyon', body), render)]);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM rapport').get().n, 1);
  assert.equal(S.busy, false);
});

test('import de nomenclature : CSV / lignes Excel → arbre ; erreurs localisées ; export CSV protégé', () => {
  const r = treeFromRows(parseCsv('Site;Atelier;Ligne de production;Machine\nS1;A1;L1;M1\n;;;M2\nS2;A2;L2;M3'));
  assert.equal(r.count, 9); assert.deepEqual(r.tree[0].kids[0].kids[0].kids.map((m) => m.n), ['M1', 'M2']);
  assert.equal(treeFromRows([{ Site: 'S', Atelier: 'A', Ligne: 'L', Machine: 'M' }]).count, 4);
  assert.match(treeFromRows(parseCsv('S;A;;M')).error, /Ligne 1.*niveau/);
  assert.match(treeFromRows([]).error, /Aucune ligne/);
  assert.equal(toCsv([['a;b', 'c"d']]), '\uFEFF"a;b";"c""d"');
});

test('téléversement : formats, taille et doublons refusés avant tout envoi', () => {
  const d = { docs: [{ n: 'Existe.pdf' }] };
  assert.match(rejectReason({ name: 'photo.jpg', size: 1 }, d), /Format non supporté/);
  assert.match(rejectReason({ name: 'gros.pdf', size: 60 * 1024 * 1024 }, d), /50 Mo/);
  assert.match(rejectReason({ name: 'Existe.pdf', size: 1 }, d), /Nouvelle version/);
  assert.equal(rejectReason({ name: 'ok.docx', size: 10 }, d), '');
});

test('écrans : tous les écrans se rendent sans erreur, y compris les nouveaux états', () => {
  S.role = 'admin'; S.project = 'lyon';
  S.docs.sem = { q: 'graissage', loading: false, err: '', hits: [{ doc: 'a.pdf', ver: 2, section: 'Entretien', page: 4, score: 0.83, extrait: 'Graisser' }] };
  S.docv.upd = true; S.docv.edit = true;
  for (const [name, fn] of Object.entries(pages)) { if (['refuse'].includes(name)) continue; assert.equal(typeof fn(), 'string', name); }
  assert.match(pages.documents(), /pertinence 83 %/);
  S.role = 'technicien'; S.projects = [{ id: 'lyon', n: 'Lyon' }, { id: 'grenoble', n: 'Grenoble' }];
  assert.match(pages.chatbot(), /data-input="project"/, 'un technicien multi-projets peut changer de projet');
  assert.match(pages.chatbot(), /Périmètre de la recherche/);
  assert.match(pages.compte(), /Changer mon mot de passe/);
});
