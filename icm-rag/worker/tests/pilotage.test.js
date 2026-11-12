import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeD1 } from './d1shim.js';
import { createD1Repository } from '../src/adapters/outbound/d1/d1Repository.js';
import { createD1Catalog } from '../src/adapters/outbound/d1/d1Catalog.js';
import { createApiHandler } from '../src/adapters/inbound/http/apiHandler.js';
import * as webCrypto from '../src/adapters/outbound/cloudflare/webCrypto.js';
import { createRouter } from '../src/adapters/inbound/http/router.js';
import { createHttpHandlers } from '../src/adapters/inbound/http/handlers.js';
import { makeAskQuestion } from '../src/application/use-cases/askQuestion.js';
import { makeSearchPassages } from '../src/application/use-cases/searchPassages.js';
import { makeDeleteDocument } from '../src/application/use-cases/deleteDocument.js';
import { documentHash } from '../src/domain/text/identifiers.js';
import { chunkMarkdown } from '../src/domain/text/chunker.js';
import { toSources } from '../src/domain/rag/answerPolicy.js';
import { settings } from '../src/config/constants.js';

const PW = 'Changeme!2026';
/** API complète sur SQL réel ; Workers AI / Vectorize remplacés par des faux (les passages renvoyés dépendent du test). */
async function setup({ matches = [], llm = async () => 'Toutes les 500 h (EP2).' } = {}) {
  const db = makeD1(), vectors = { deleted: [], queries: [] };
  const vectorStore = { query: async (v, o) => { vectors.queries.push(o); return matches.map((m) => ({ ...m })); }, deleteByIds: async (ids) => { vectors.deleted.push(...ids); }, upsert: async () => {} };
  const embedder = { embed: async (t) => t.map(() => [0.1, 0.2]) };
  const catalog = createD1Catalog({ db });
  const askQuestion = makeAskQuestion({ embedder, vectorStore, llm: { generate: (a) => llm(a) }, settings });
  const searchPassages = makeSearchPassages({ embedder, vectorStore, settings });
  const deleteDocument = makeDeleteDocument({ vectorStore, catalog, settings });
  const api = createApiHandler({ repo: createD1Repository({ db }), crypto: webCrypto, secret: 's', askQuestion, searchPassages, deleteDocument });
  const noop = async () => { throw new Error('non utilisé'); };
  const router = createRouter(createHttpHandlers({ ingestDocument: noop, listDocuments: noop, deleteDocument: noop, purgeProject: noop, askQuestion: noop, api }));
  const call = async (method, path, body, token) => {
    const res = await router(new Request('https://w.test' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }));
    return { status: res.status, ...(await res.json()) };
  };
  const login = async (email, pw = PW) => (await call('POST', '/api/login', { email, password: pw })).token;
  return { db, call, login, catalog, vectors, adm: await login('admin@usine-lyon.fr'), tech: await login('p.durand@usine-lyon.fr') };
}
const hit = (doc, text, score = 0.9, extra = {}) => ({ score, metadata: { doc, ver: '1', sec: '3. Graissage', text, ...extra } });

test('chat persisté : discussion + messages + citations ; la conversation survit au rechargement', async () => {
  const S = await setup({ matches: [hit('Procédure P-12.pdf', 'Graisser toutes les 500 heures')] });
  const id = await documentHash('lyon', 'Procédure P-12.pdf');
  await S.catalog.save('lyon', { id, name: 'Procédure P-12.pdf', ver: '1', chunks: 1, chars: 10 });
  const r = await S.call('POST', '/api/projets/lyon/chat', { question: 'Fréquence de graissage ?' }, S.tech);
  assert.equal(r.status, 200); assert.equal(r.response, 'Toutes les 500 h (EP2).'); assert.ok(r.discussion_id && r.message_id);
  assert.deepEqual(r.sources[0].slice(0, 3), ['Procédure P-12.pdf', 1, '3. Graissage']);
  const r2 = await S.call('POST', '/api/projets/lyon/chat', { question: 'Et la graisse ?', discussion_id: r.discussion_id }, S.tech);
  assert.equal(r2.discussion_id, r.discussion_id, 'même fil de conversation');
  const c = S.db.sqlite.prepare('SELECT section, document_version_id v FROM citation').get();
  assert.equal(c.section, '3. Graissage'); assert.ok(c.v, 'la citation pointe la version du document');
  const list = await S.call('GET', '/api/projets/lyon/discussions', null, S.tech);
  assert.equal(list.discussions.length, 1); assert.equal(list.discussions[0].messages.length, 4);
  assert.equal(list.discussions[0].messages[1].citations[0].doc, 'Procédure P-12.pdf');
  assert.deepEqual((await S.call('GET', '/api/projets/lyon/discussions', null, S.adm)).discussions, [], 'les conversations d’un technicien ne sont pas celles de l’admin');
  assert.equal((await S.call('POST', '/api/projets/lyon/chat', { question: '' }, S.tech)).status, 400);
  assert.equal((await S.call('POST', '/api/projets/grenoble/chat', { question: 'x' }, S.tech)).status, 403);
});

test('« Je ne sais pas » enregistré comme tel (sans source)', async () => {
  const S = await setup({ matches: [] });
  const r = await S.call('POST', '/api/projets/lyon/chat', { question: 'Budget maintenance ?' }, S.tech);
  assert.match(r.response, /^Je ne sais pas/); assert.deepEqual(r.sources, []);
  assert.equal(S.db.sqlite.prepare("SELECT sans_reponse s FROM message WHERE role = 'assistant'").get().s, 1);
});

test('panne du moteur : 502 explicite, rien d’enregistré', async () => {
  const S = await setup({ matches: [hit('a.pdf', 't')], llm: async () => { throw new Error('modèle indisponible'); } });
  const r = await S.call('POST', '/api/projets/lyon/chat', { question: 'x ?' }, S.tech);
  assert.equal(r.status, 502); assert.match(r.error, /modèle indisponible/);
  assert.equal(S.db.sqlite.prepare('SELECT COUNT(*) n FROM discussion').get().n, 0);
});

test('périmètre équipement : seuls les documents de l’équipement, de ses ancêtres et non rattachés répondent', async () => {
  const S = await setup();
  const mk = async (type, nom, parent_id) => (await S.call('POST', '/api/projets/lyon/noeuds', { type, nom, parent_id }, S.adm)).id;
  const site = await mk('Site', 'S1'), at = await mk('Atelier', 'A1', site), li = await mk('Ligne de production', 'L1', at);
  const p12 = await mk('Machine', 'Pompe P-12', li), k4 = await mk('Machine', 'Compresseur K-4', li);
  const docs = { 'P12.pdf': p12, 'K4.pdf': k4, 'Plan site.pdf': site, 'Libre.pdf': null };
  for (const [name, node] of Object.entries(docs)) {
    const id = await documentHash('lyon', name); await S.catalog.save('lyon', { id, name, ver: '1', chunks: 1, chars: 5 });
    if (node) assert.equal((await S.call('PATCH', `/api/projets/lyon/documents/${id}`, { node_id: node }, S.adm)).status, 200);
  }
  // le faux Vectorize de S ne renvoie rien : on branche un store qui « voit » les 4 documents, sur la MÊME base SQL
  const vs = { query: async () => Object.keys(docs).map((n) => hit(n, 'texte ' + n)) };
  const ask = makeAskQuestion({ embedder: { embed: async (t) => t.map(() => [1]) }, vectorStore: vs, llm: { generate: async () => 'ok' }, settings });
  const api = createApiHandler({ repo: createD1Repository({ db: S.db }), crypto: webCrypto, secret: 's', askQuestion: ask });
  const call = async (path, body) => { const res = await api(new Request('https://w.test' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.tech }, body: JSON.stringify(body) })); return res.json(); };
  const all = await call('/api/projets/lyon/chat', { question: 'q' });
  assert.deepEqual(all.sources.map((s) => s[0]), Object.keys(docs), 'sans périmètre : comportement historique (tout le projet)');
  const scoped = await call('/api/projets/lyon/chat', { question: 'q', node_id: p12 });
  assert.deepEqual(scoped.sources.map((s) => s[0]).sort(), ['Libre.pdf', 'P12.pdf', 'Plan site.pdf'], 'le compresseur K-4 est exclu pour une question sur la pompe P-12');
  assert.equal((await call('/api/projets/lyon/chat', { question: 'q', node_id: 'inconnu' })).ok, false);
});

test('retrieveHits : sur-échantillonnage uniquement quand un périmètre est donné', async () => {
  const S = await setup({ matches: [hit('a.pdf', 't')] });
  await S.call('POST', '/api/projets/lyon/chat', { question: 'q' }, S.tech);
  assert.equal(S.vectors.queries.at(-1).topK, settings.TOP_K);
  const site = (await S.call('POST', '/api/projets/lyon/noeuds', { type: 'Site', nom: 'S1' }, S.adm)).id;
  await S.call('POST', '/api/projets/lyon/chat', { question: 'q', node_id: site }, S.tech);
  assert.equal(S.vectors.queries.at(-1).topK, settings.SCOPE_FETCH);
});

test('évaluation : persistée, une seule par réponse, motif exigé ; réservée à l’auteur de la conversation', async () => {
  const S = await setup({ matches: [hit('a.pdf', 'extrait')] });
  const r = await S.call('POST', '/api/projets/lyon/chat', { question: 'Couple de serrage ?' }, S.tech);
  const url = `/api/projets/lyon/messages/${r.message_id}/note`;
  assert.equal((await S.call('POST', url, { niveau: 'partielle' }, S.tech)).status, 422, 'motif obligatoire si non satisfaisant');
  assert.equal((await S.call('POST', url, { niveau: 'bof', motif: 'Autre motif' }, S.tech)).status, 400);
  assert.equal((await S.call('POST', url, { niveau: 'partielle', motif: 'Information incomplète', commentaire: 'Manque la valeur en N·m' }, S.adm)).status, 404, 'pas l’auteur');
  assert.equal((await S.call('POST', url, { niveau: 'partielle', motif: 'Information incomplète', commentaire: 'Manque la valeur en N·m' }, S.tech)).status, 201);
  assert.equal((await S.call('POST', url, { niveau: 'satisfaisante' }, S.tech)).status, 409, 'déjà évaluée');
  const n = S.db.sqlite.prepare('SELECT * FROM note').get();
  assert.deepEqual([n.niveau_utile, n.motif, n.statut_suivi, n.message_id], ['partielle', 'Information incomplète', 'À analyser', r.message_id]);
  const d = (await S.call('GET', '/api/projets/lyon/discussions', null, S.tech)).discussions[0];
  assert.equal(d.messages[1].note.niveau_utile, 'partielle', 'l’évaluation est restituée après rechargement');
});

test('indicateurs : volumes, satisfaction, motifs, sources, qualification, MTTR ; accès administrateur uniquement', async () => {
  const S = await setup({ matches: [hit('Procédure P-12.pdf', 'extrait')] });
  const id = await documentHash('lyon', 'Procédure P-12.pdf');
  await S.catalog.save('lyon', { id, name: 'Procédure P-12.pdf', ver: '1', chunks: 1, chars: 10 });
  const rate = async (q, niveau, motif) => { const r = await S.call('POST', '/api/projets/lyon/chat', { question: q }, S.tech); await S.call('POST', `/api/projets/lyon/messages/${r.message_id}/note`, { niveau, motif }, S.tech); return r; };
  await rate('q1', 'satisfaisante'); await rate('q2', 'satisfaisante'); const bad = await rate('Quel couple ?', 'incorrecte', 'Information erronée');
  assert.equal((await S.call('GET', '/api/projets/lyon/indicateurs', null, S.tech)).status, 403);
  const i = await S.call('GET', '/api/projets/lyon/indicateurs?per=30', null, S.adm);
  assert.deepEqual([i.questions, i.reponses, i.sans_reponse], [3, 3, 0]);
  assert.deepEqual(i.evaluations, { satisfaisante: 2, partielle: 0, incorrecte: 1, total: 3 });
  assert.equal(i.taux_satisfaction, 66.7); assert.equal(i.taux_evaluation, 100);
  assert.deepEqual(i.motifs, [{ motif: 'Information erronée', n: 1 }]);
  assert.deepEqual(i.sources_citees, [{ doc: 'Procédure P-12.pdf', n: 3 }]);
  assert.deepEqual([i.qualification.indexe, i.qualification.total, i.qualification.taux_valide], [1, 1, 0]);
  assert.equal(i.signalements_a_analyser, 1); assert.equal(i.signalements[0].question, 'Quel couple ?');
  assert.match(i.signalements[0].sources, /Procédure P-12\.pdf · v1 · § 3\. Graissage/);
  assert.equal(i.signalements[0].auteur, 'p.durand');
  // boucle de feedback : traitement tracé
  const nid = i.signalements[0].id;
  assert.equal((await S.call('PATCH', `/api/projets/lyon/notes/${nid}`, { statut: 'Corrigé' }, S.adm)).status, 422, 'correction à décrire');
  assert.equal((await S.call('PATCH', `/api/projets/lyon/notes/${nid}`, { statut: 'Corrigé', commentaire: 'Source v2 publiée' }, S.tech)).status, 403);
  assert.equal((await S.call('PATCH', `/api/projets/lyon/notes/${nid}`, { statut: 'Corrigé', commentaire: 'Source v2 publiée' }, S.adm)).status, 200);
  const j = await S.call('GET', '/api/projets/lyon/indicateurs', null, S.adm);
  assert.equal(j.signalements_a_analyser, 0); assert.deepEqual([j.signalements[0].statut_suivi, j.signalements[0].traite_par, j.signalements[0].suivi_commentaire], ['Corrigé', 'admin', 'Source v2 publiée']);
  assert.ok((await S.call('GET', '/api/projets/lyon/bootstrap', null, S.adm)).logs.some((l) => l.action === 'Signalement'));
});

test('indicateurs : projet vide → zéros et taux nuls (pas de division par zéro) ; intervention = base du MTTR', async () => {
  const S = await setup();
  const e = await S.call('GET', '/api/projets/lyon/indicateurs?per=all', null, S.adm);
  assert.deepEqual([e.questions, e.taux_satisfaction, e.taux_evaluation, e.qualification.taux_valide, e.interventions.n, e.interventions.duree_moyenne], [0, null, null, null, 0, null]);
  const mk = async (type, nom, parent_id) => (await S.call('POST', '/api/projets/lyon/noeuds', { type, nom, parent_id }, S.adm)).id;
  const m = await mk('Machine', 'M', await mk('Ligne de production', 'L', await mk('Atelier', 'A', await mk('Site', 'S'))));
  const today = new Date().toISOString().slice(0, 10);
  for (const duree of [1, 2]) await S.call('POST', '/api/projets/lyon/interventions', { machine_id: m, date: today, probleme: 'p', diagnostic: 'd', actions: 'a', etat_final: 'ok', duree }, S.adm);
  const i = await S.call('GET', '/api/projets/lyon/indicateurs?per=7', null, S.adm);
  assert.deepEqual([i.interventions.n, i.interventions.duree_moyenne], [2, 1.5]);
});

test('suppression d’un document : fiche, vecteurs, connaissances ; refusée au technicien ; tracée', async () => {
  const S = await setup();
  const id = await documentHash('lyon', 'Vieux.pdf');
  await S.catalog.save('lyon', { id, name: 'Vieux.pdf', ver: '1', chunks: 2, chars: 10 });
  const vid = S.db.sqlite.prepare('SELECT id FROM document_version').get().id;
  S.db.sqlite.prepare("INSERT INTO connaissance (id, sujet, relation, objet, document_version_id) VALUES ('k1','A','r','B',?)").run(vid);
  assert.equal((await S.call('DELETE', `/api/projets/lyon/documents/${id}`, null, S.tech)).status, 403);
  const r = await S.call('DELETE', `/api/projets/lyon/documents/${id}`, null, S.adm);
  assert.deepEqual([r.status, r.connaissances], [200, 1]);
  assert.equal(S.db.sqlite.prepare('SELECT COUNT(*) n FROM document').get().n, 0);
  assert.equal(S.db.sqlite.prepare('SELECT COUNT(*) n FROM connaissance').get().n, 0);
  assert.ok(S.vectors.deleted.length > 0 && S.vectors.deleted[0].startsWith(id), 'les vecteurs du document sont supprimés');
  assert.ok(S.db.sqlite.prepare("SELECT 1 FROM log WHERE action = 'Suppression'").get());
  assert.equal((await S.call('DELETE', `/api/projets/lyon/documents/${id}`, null, S.adm)).status, 404);
});

test('gouvernance : accès refusé tracé (cybersécurité), auto-désactivation interdite, rôle inchangé en cas de refus', async () => {
  const S = await setup();
  assert.equal((await S.call('POST', '/api/projets/lyon/noeuds', { type: 'Site', nom: 'X' }, S.tech)).status, 403);
  assert.equal((await S.call('GET', '/api/projets/grenoble/bootstrap', null, S.tech)).status, 403);
  const rows = S.db.sqlite.prepare("SELECT projet_id p, status s, detail d FROM log WHERE action = 'Accès refusé' ORDER BY rowid").all();
  assert.deepEqual(rows.map((r) => [r.p, r.s]), [['lyon', 'Échec'], ['grenoble', 'Échec']]);
  assert.equal((await S.call('GET', '/api/projets/inexistant/bootstrap', null, S.tech)).status, 403, 'projet inconnu : refus propre, sans erreur de clé étrangère');
  await S.call('POST', '/api/projets/lyon/users', { email: 'second@usine-lyon.fr', role: 'Admin' }, S.adm);
  const me = await S.call('PATCH', '/api/projets/lyon/users/u-admin-lyon', { is_active: false }, S.adm);
  assert.equal(me.status, 409); assert.match(me.error, /propre compte/);
});

test('mot de passe : politique, ancien vérifié, effet immédiat, tracé', async () => {
  const S = await setup();
  assert.equal((await S.call('POST', '/api/me/password', { ancien: 'faux', nouveau: 'Nouveau-mdp-2026' }, S.tech)).status, 403);
  assert.equal((await S.call('POST', '/api/me/password', { ancien: PW, nouveau: 'court1' }, S.tech)).status, 422);
  assert.equal((await S.call('POST', '/api/me/password', { ancien: PW, nouveau: 'uniquementdeslettres' }, S.tech)).status, 422);
  assert.equal((await S.call('POST', '/api/me/password', { ancien: PW, nouveau: PW }, S.tech)).status, 422);
  assert.equal((await S.call('POST', '/api/me/password', { ancien: PW, nouveau: 'Nouveau-mdp-2026' }, S.tech)).status, 200);
  assert.equal((await S.call('POST', '/api/login', { email: 'p.durand@usine-lyon.fr', password: PW })).status, 401);
  assert.equal((await S.call('POST', '/api/login', { email: 'p.durand@usine-lyon.fr', password: 'Nouveau-mdp-2026' })).status, 200);
  assert.equal(S.db.sqlite.prepare("SELECT COUNT(*) n FROM log WHERE action = 'Changement de mot de passe'").get().n, 2);
});

test('RGPD : export des données, anonymisation d’un compte désactivé, purge selon la durée de conservation', async () => {
  const S = await setup({ matches: [hit('a.pdf', 'extrait')] });
  await S.call('POST', '/api/projets/lyon/chat', { question: 'Question perso ?' }, S.tech);
  const exp = await S.call('GET', '/api/me/export', null, S.tech);
  assert.equal(exp.donnees.user.email, 'p.durand@usine-lyon.fr'); assert.equal(exp.donnees.conversations[0].messages.length, 2);
  assert.ok(!JSON.stringify(exp).includes('pbkdf2'), 'le hash du mot de passe n’est jamais exporté');
  const id = 'u-tech-lyon';
  const early = await S.call('POST', `/api/projets/lyon/users/${id}/anonymiser`, null, S.adm);
  assert.equal(early.status, 409, 'compte actif : désactivation préalable exigée');
  await S.call('PATCH', `/api/projets/lyon/users/${id}`, { is_active: false }, S.adm);
  const an = await S.call('POST', `/api/projets/lyon/users/${id}/anonymiser`, null, S.adm);
  assert.equal(an.status, 200); assert.match(an.alias, /^anonyme-/);
  const u = S.db.sqlite.prepare('SELECT login, email, is_active FROM user WHERE id = ?').get(id);
  assert.deepEqual([u.is_active, u.email.endsWith('@supprime.invalid')], [0, true]);
  assert.equal(S.db.sqlite.prepare('SELECT user_id FROM discussion').get().user_id, null, 'conversation détachée de la personne');
  assert.equal((await S.call('POST', '/api/login', { email: 'p.durand@usine-lyon.fr', password: PW })).status, 401);
  assert.equal((await S.call('POST', `/api/projets/lyon/users/u-admin-lyon/anonymiser`, null, S.adm)).status, 409, 'pas soi-même');
  // purge
  assert.equal((await S.call('POST', '/api/projets/lyon/conversations/purge', { jours: 5 }, S.adm)).status, 422, 'durée minimale');
  S.db.sqlite.prepare("UPDATE discussion SET created_at = datetime('now', '-400 days')").run();
  const p = await S.call('POST', '/api/projets/lyon/conversations/purge', { jours: 365 }, S.adm);
  assert.deepEqual([p.status, p.supprimees], [200, 1]);
  assert.equal(S.db.sqlite.prepare('SELECT COUNT(*) n FROM message').get().n, 0, 'messages supprimés en cascade');
});

test('purge RGPD : une évaluation encore « À analyser » protège sa conversation', async () => {
  const S = await setup({ matches: [hit('a.pdf', 'extrait')] });
  const r = await S.call('POST', '/api/projets/lyon/chat', { question: 'q' }, S.tech);
  await S.call('POST', `/api/projets/lyon/messages/${r.message_id}/note`, { niveau: 'incorrecte', motif: 'Autre motif' }, S.tech);
  S.db.sqlite.prepare("UPDATE discussion SET created_at = datetime('now', '-400 days')").run();
  assert.equal((await S.call('POST', '/api/projets/lyon/conversations/purge', { jours: 365 }, S.adm)).supprimees, 0);
});

test('recherche sémantique : passages scorés, périmètre respecté, requête vide refusée', async () => {
  const S = await setup({ matches: [hit('a.pdf', 'Graisser les paliers', 0.83, { page: 4 })] });
  const r = await S.call('POST', '/api/projets/lyon/recherche', { q: 'graissage' }, S.tech);
  assert.deepEqual([r.status, r.resultats[0].doc, r.resultats[0].score, r.resultats[0].page], [200, 'a.pdf', 0.83, 4]);
  assert.equal((await S.call('POST', '/api/projets/lyon/recherche', { q: ' ' }, S.tech)).status, 400);
  assert.equal((await S.call('POST', '/api/projets/grenoble/recherche', { q: 'x' }, S.tech)).status, 403);
});

test('citations : le numéro de page n’existe que si le texte converti contient des sauts de page', () => {
  const plain = chunkMarkdown('# Titre\n\nPremier paragraphe.\n\nSecond.', { size: 1500, overlap: 200 });
  assert.deepEqual(plain, [{ text: '# Titre\n\nPremier paragraphe.\n\nSecond.', section: 'Titre' }], 'comportement historique inchangé : aucune clé page');
  const paged = chunkMarkdown('# Notice\n\nPage un.\f## Entretien\n\nPage deux, graissage.\f\nPage trois.', { size: 40, overlap: 0 });
  assert.deepEqual(paged.map((c) => [c.section, c.page]), [['Notice', 1], ['Entretien', 2], ['Entretien', 3]]);
  assert.deepEqual(toSources([{ metadata: { doc: 'd.pdf', ver: '2', sec: 'Entretien', text: 'x', page: 2 } }])[0].slice(0, 5), ['d.pdf', 2, 'Entretien', '« x… »', 2]);
  assert.equal(toSources([{ metadata: { doc: 'd.pdf', ver: '2', sec: 'Entretien', text: 'x' } }])[0].length, 4, 'sans page : source à 4 éléments comme avant');
});

test('migration 0003 : s’applique sur l’ancien schéma sans perte', () => {
  const sq = new DatabaseSync(':memory:');
  sq.exec(`PRAGMA foreign_keys = ON; CREATE TABLE user (id TEXT PRIMARY KEY); CREATE TABLE discussion (id TEXT PRIMARY KEY, user_id TEXT, projet_id TEXT);
    CREATE TABLE message (id TEXT PRIMARY KEY, discussion_id TEXT);
    CREATE TABLE note (id TEXT PRIMARY KEY, niveau_utile TEXT, commentaire TEXT, motif TEXT, statut_suivi TEXT DEFAULT 'À analyser', created_at TIMESTAMP, discussion_id TEXT NOT NULL);
    CREATE TABLE citation (id TEXT PRIMARY KEY, page INTEGER, extrait TEXT, message_id TEXT NOT NULL);
    INSERT INTO note (id, niveau_utile, discussion_id) VALUES ('n1', 'partielle', 'd1');`);
  sq.exec(readFileSync(new URL('../migrations/0003_pilotage.sql', import.meta.url), 'utf8'));
  const cols = (t) => sq.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  assert.ok(['message_id', 'suivi_commentaire', 'traite_par', 'traite_at'].every((c) => cols('note').includes(c)));
  assert.ok(cols('citation').includes('section'));
  assert.equal(sq.prepare("SELECT niveau_utile n FROM note WHERE id = 'n1'").get().n, 'partielle');
});

test('rapport : la clé étrangère est RESTRICT (plus de destruction silencieuse des comptes rendus)', async () => {
  const S = await setup();
  const mk = async (type, nom, parent_id) => (await S.call('POST', '/api/projets/lyon/noeuds', { type, nom, parent_id }, S.adm)).id;
  const m = await mk('Machine', 'M', await mk('Ligne de production', 'L', await mk('Atelier', 'A', await mk('Site', 'S'))));
  await S.call('POST', '/api/projets/lyon/interventions', { machine_id: m, date: '2026-10-16', probleme: 'p', diagnostic: 'd', actions: 'a', etat_final: 'ok' }, S.adm);
  assert.throws(() => S.db.sqlite.prepare('DELETE FROM machine WHERE id = ?').run(m), /FOREIGN KEY/);
  assert.equal(S.db.sqlite.prepare('SELECT COUNT(*) n FROM rapport').get().n, 1);
});

test('routes RAG : sans RAG_REQUIRE_AUTH comportement historique ; avec, jeton + rôle exigés (401/403), Admin pour écrire', async () => {
  const { makeRagAuthorize } = await import('../src/adapters/inbound/http/ragAuth.js');
  const S = await setup();
  const calls = [];
  const spy = async (n) => { calls.push(n); return { ok: true, docs: [], response: 'r', sources: [] }; };
  const build = (authorize) => createRouter(createHttpHandlers({ ingestDocument: () => spy('ingest'), listDocuments: () => spy('list'), deleteDocument: () => spy('delete'), purgeProject: () => spy('purge'), askQuestion: () => spy('chat'), authorize }));
  const open = build(undefined);
  const post = (router, path, body, token, form) => router(new Request('https://w.test' + path, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: form || JSON.stringify(body) }));
  assert.equal((await post(open, '/', { action: 'chat', question: 'q', project: 'lyon' })).status, 200, 'ouvert par défaut (historique)');
  const guarded = build(makeRagAuthorize({ repo: createD1Repository({ db: S.db }), crypto: webCrypto, secret: 's', defaultProject: 'lyon' }));
  const fd = () => { const f = new FormData(); f.append('project', 'lyon'); f.append('doc', 'x.pdf'); f.append('text', 'x'); return f; };
  assert.equal((await post(guarded, '/', { action: 'chat', question: 'q', project: 'lyon' })).status, 401);
  assert.equal((await post(guarded, '/', { action: 'chat', question: 'q', project: 'lyon' }, S.tech)).status, 200, 'technicien : lecture/chat autorisés');
  assert.equal((await post(guarded, '/', { action: 'chat', question: 'q', project: 'grenoble' }, S.tech)).status, 403, 'autre projet refusé');
  assert.equal((await post(guarded, '/list', { project: 'lyon' }, S.tech)).status, 200);
  assert.equal((await post(guarded, '/ingest', null, S.tech, fd())).status, 403, 'technicien : pas d’écriture');
  assert.equal((await post(guarded, '/delete', null, S.tech, fd())).status, 403);
  assert.equal((await post(guarded, '/purge', null, S.tech, fd())).status, 403);
  assert.equal((await post(guarded, '/ingest', null, S.adm, fd())).status, 200);
  assert.equal((await post(guarded, '/purge', null, S.adm, fd())).status, 200);
  assert.equal(calls.filter((c) => c === 'ingest').length, 1);
});

test('purge planifiée : retention() applique la durée à tous les projets', async () => {
  const { buildApp } = await import('../src/composition/buildApp.js');
  const S = await setup({ matches: [hit('a.pdf', 'x')] });
  await S.call('POST', '/api/projets/lyon/chat', { question: 'q' }, S.tech);
  S.db.sqlite.prepare("UPDATE discussion SET created_at = datetime('now', '-400 days')").run();
  const app = buildApp({ DB: S.db, AI: {}, VECTORIZE: {}, AUTH_SECRET: 's' });
  assert.equal(await app.retention(), 1);
  assert.equal(S.db.sqlite.prepare('SELECT COUNT(*) n FROM discussion').get().n, 0);
});
