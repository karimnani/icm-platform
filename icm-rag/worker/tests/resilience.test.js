import test from 'node:test';
import assert from 'node:assert/strict';
import { settings } from '../src/config/constants.js';
import { ApplicationError } from '../src/application/errors.js';
import { withRetry, withTimeout, isTransient, classifyInfraError, purgeAllProjects, TimeoutError } from '../src/application/services/resilience.js';
import { createWorkersAiEmbedder } from '../src/adapters/outbound/cloudflare/workersAiEmbedder.js';
import { createWorkersAiLlm } from '../src/adapters/outbound/cloudflare/workersAiLlm.js';
import { createWorkersAiConverter } from '../src/adapters/outbound/cloudflare/workersAiConverter.js';
import { createVectorizeStore } from '../src/adapters/outbound/cloudflare/vectorizeStore.js';
import { makeIngestDocument } from '../src/application/use-cases/ingestDocument.js';
import { makeAskQuestion } from '../src/application/use-cases/askQuestion.js';
import { createRouter } from '../src/adapters/inbound/http/router.js';
import { createHttpHandlers } from '../src/adapters/inbound/http/handlers.js';
import { createApiHandler } from '../src/adapters/inbound/http/apiHandler.js';
import worker from '../src/index.js';

const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const noSleep = { sleep: async () => {} };

// ---------- briques ----------
test('isTransient : pannes passagères oui ; erreur métier, quota journalier, erreur de programmation non', () => {
  assert.equal(isTransient(new Error('3040: Capacity temporarily exceeded')), true);
  assert.equal(isTransient(new Error('D1_ERROR: SQLITE_BUSY: database is locked')), true);
  assert.equal(isTransient(Object.assign(new Error('x'), { status: 503 })), true);
  assert.equal(isTransient(new TimeoutError('a', 10)), true);
  assert.equal(isTransient(new ApplicationError('Contenu trop court', 422)), false);
  assert.equal(isTransient(new Error('you have used up your daily free allocation')), false);
  assert.equal(isTransient(new TypeError('x is not a function')), false);
});
test('withRetry : réessaie une panne passagère, jamais une erreur non transitoire ; borne le nombre d’essais', async () => {
  let n = 0;
  assert.equal(await withRetry(async () => { if (++n < 2) throw new Error('503 service unavailable'); return 'ok'; }, noSleep), 'ok'); assert.equal(n, 2);
  n = 0; await assert.rejects(withRetry(async () => { n++; throw new TypeError('bug'); }, noSleep)); assert.equal(n, 1);
  n = 0; await assert.rejects(withRetry(async () => { n++; throw new Error('timeout'); }, { attempts: 3, ...noSleep })); assert.equal(n, 3);
});
test('withTimeout : rend la valeur si rapide, TimeoutError sinon', async () => {
  assert.equal(await withTimeout(async () => 7, 50), 7);
  await assert.rejects(withTimeout(() => new Promise(() => {}), 20, 'Test'), (e) => e instanceof TimeoutError && /Test/.test(e.message));
});
test('classifyInfraError : message générique inchangé pour l’inconnu, 503 pour le transitoire/quota, statut métier conservé', () => {
  assert.deepEqual(classifyInfraError(new Error('boum')), { status: 500, message: 'Erreur interne du serveur.' });
  assert.equal(classifyInfraError(new Error('database is locked')).status, 503);
  assert.match(classifyInfraError(new Error('daily allocation used up')).message, /Quota/);
  assert.deepEqual(classifyInfraError(new ApplicationError('non', 409)), { status: 409, message: 'non' });
});
test('purgeAllProjects : un projet en échec n’empêche pas les suivants', async () => {
  const repo = { projectIds: async () => ['a', 'b', 'c'], purgeConversations: async (id) => { if (id === 'b') throw new Error('KO'); return 2; } };
  const seen = []; const r = await purgeAllProjects(repo, 365, { onError: (id) => seen.push(id) });
  assert.deepEqual(r, { total: 4, failed: ['b'] }); assert.deepEqual(seen, ['b']);
});

// ---------- adaptateurs ----------
test('embedder : une panne passagère est retentée et le résultat est identique ; une erreur de code ne l’est pas', async () => {
  let n = 0; const ai = { run: async () => { if (++n === 1) throw new Error('Capacity temporarily exceeded'); return { data: [[1], [2]] }; } };
  const emb = createWorkersAiEmbedder({ ai, model: 'm', batchSize: 10, retry: noSleep });
  assert.deepEqual(await emb.embed(['a', 'b']), [[1], [2]]); assert.equal(n, 2);
  const bad = createWorkersAiEmbedder({ ai: { run: async () => { throw new TypeError('bug'); } }, model: 'm', batchSize: 10, retry: noSleep });
  await assert.rejects(bad.embed(['a']), TypeError);
});
test('embedder : un appel qui ne répond jamais est interrompu par le délai', async () => {
  const emb = createWorkersAiEmbedder({ ai: { run: () => new Promise(() => {}) }, model: 'm', batchSize: 10, timeoutMs: 20, retry: { attempts: 1 } });
  await assert.rejects(emb.embed(['a']), TimeoutError);
});
test('Vectorize : query/upsert/delete retentés une fois sur panne passagère ; réponse sans « matches » → liste vide', async () => {
  let q = 0, u = 0;
  const idx = { query: async () => { if (++q === 1) throw new Error('502 bad gateway'); return { matches: [{ id: 1 }] }; }, upsert: async () => { if (++u === 1) throw new Error('timeout'); }, deleteByIds: async () => {} };
  const s = createVectorizeStore({ index: idx, retry: noSleep });
  assert.deepEqual(await s.query([1], { topK: 1, namespace: 'x' }), [{ id: 1 }]); assert.equal(q, 2);
  await s.upsert([{ id: 'a' }]); assert.equal(u, 2);
  assert.deepEqual(await createVectorizeStore({ index: { query: async () => undefined } }).query([1], { topK: 1, namespace: 'x' }), []);
});
test('LLM : délai maximal ; sortie absente → undefined (sans exception TypeError)', async () => {
  await assert.rejects(createWorkersAiLlm({ ai: { run: () => new Promise(() => {}) }, model: 'm', timeoutMs: 20 }).generate({ messages: [], maxTokens: 1 }), TimeoutError);
  assert.equal(await createWorkersAiLlm({ ai: { run: async () => undefined }, model: 'm' }).generate({ messages: [], maxTokens: 1 }), undefined);
});
test('convertisseur : panne inattendue → 502 lisible ; 422 historique conservé', async () => {
  const file = { name: 'a.pdf', arrayBuffer: async () => new ArrayBuffer(4) };
  await quiet(async () => {
    await assert.rejects(createWorkersAiConverter({ ai: { toMarkdown: async () => { throw new Error('boom'); } } }).toMarkdown(file), (e) => e instanceof ApplicationError && e.status === 502);
    await assert.rejects(createWorkersAiConverter({ ai: { toMarkdown: async () => ({ format: 'error' }) } }).toMarkdown(file), (e) => e.status === 422);
  });
  assert.equal(await createWorkersAiConverter({ ai: { toMarkdown: async () => [{ data: 'texte' }] } }).toMarkdown(file), 'texte');
});

// ---------- cas d'usage ----------
test('ingestion : empreintes incomplètes → 502 et AUCUNE écriture (plus de vecteurs « undefined »)', async () => {
  const written = [];
  const ing = makeIngestDocument({ documentConverter: {}, embedder: { embed: async () => [] }, vectorStore: { upsert: async (r) => written.push(...r), deleteByIds: async () => {} },
    catalog: { save: async () => ({ status: 200 }) }, settings, today: () => 'x' });
  await assert.rejects(ing({ rawText: 'x'.repeat(100), name: 'a.pdf', project: 'lyon' }), (e) => e.status === 502 && /incomplet/.test(e.message));
  assert.equal(written.length, 0);
});
test('question : sortie vide du modèle → 502 explicite (au lieu d’une réponse vide enregistrée)', async () => {
  const store = { query: async () => [{ score: 0.9, metadata: { doc: 'a', ver: 1, text: 't' } }] };
  const ask = makeAskQuestion({ embedder: { embed: async () => [[1]] }, vectorStore: store, llm: { generate: async () => undefined }, settings });
  await assert.rejects(ask({ question: 'q' }), (e) => e.status === 502);
});

// ---------- HTTP ----------
const noop = async () => { throw new Error('non utilisé'); };
test('routeur : exception inattendue → message conservé + référence ; transitoire → 503 ; erreur métier inchangée', async () => {
  const mk = (err) => createRouter(createHttpHandlers({ ingestDocument: noop, listDocuments: noop, deleteDocument: noop, purgeProject: noop, askQuestion: async () => { throw err; } }));
  const post = (r) => r(new Request('https://w/', { method: 'POST', body: JSON.stringify({ action: 'chat', question: 'q' }) }));
  await quiet(async () => {
    const a = await post(mk(new Error('boum'))); const ja = await a.json();
    assert.equal(a.status, 500); assert.equal(ja.error, 'boum'); assert.match(ja.ref, /^[0-9a-f]{8}$/);
    assert.equal((await post(mk(new Error('database is locked')))).status, 503);
    const c = await post(mk(new ApplicationError('refus', 409))); assert.equal(c.status, 409); assert.equal('ref' in (await c.json()), false);
  });
});
test('API : panne D1 passagère → 503 + référence ; erreur inconnue → 500 générique + référence', async () => {
  const mk = (err) => createApiHandler({ repo: { userById: async () => { throw err; } }, crypto: { verifyToken: async () => ({ uid: 'u' }) }, secret: 's' });
  const call = (h) => h(new Request('https://w/api/me', { headers: { Authorization: 'Bearer t' } }));
  await quiet(async () => {
    const a = await call(mk(new Error('D1_ERROR: SQLITE_BUSY'))); const ja = await a.json();
    assert.equal(a.status, 503); assert.ok(ja.ref); assert.match(ja.error, /momentanément/);
    const b = await call(mk(new Error('secret interne'))); const jb = await b.json();
    assert.equal(b.status, 500); assert.equal(jb.error, 'Erreur interne du serveur.'); assert.ok(jb.ref);
  });
});
test('point d’entrée : exception à la construction → JSON 500 + CORS + référence (jamais une erreur brute)', async () => {
  const env = { ALLOWED_ORIGIN: 'https://icm-app.pages.dev', get VECTORIZE() { throw new Error('liaison cassée'); } };
  await quiet(async () => {
    const res = await worker.fetch(new Request('https://w/api/me', { headers: { Origin: 'https://icm-app.pages.dev' } }), env);
    const j = await res.json();
    assert.equal(res.status, 500); assert.equal(j.ok, false); assert.ok(j.ref);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://icm-app.pages.dev');
  });
});
test('tâche planifiée : une exception est journalisée, ne remonte pas', async () => {
  let waited; await quiet(async () => {
    await worker.scheduled({}, { get VECTORIZE() { throw new Error('KO'); } }, { waitUntil: (p) => { waited = p; } });
    await assert.doesNotReject(waited);
  });
});
