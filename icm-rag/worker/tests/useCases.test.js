import test from 'node:test';
import assert from 'node:assert/strict';
import { settings } from '../src/config/constants.js';
import { makeAskQuestion } from '../src/application/use-cases/askQuestion.js';
import { makeDeleteDocument } from '../src/application/use-cases/deleteDocument.js';
import { makePurgeProject } from '../src/application/use-cases/purgeProject.js';
import { makeIngestDocument } from '../src/application/use-cases/ingestDocument.js';
import { ApplicationError } from '../src/application/errors.js';
import { NO_ANSWER_MESSAGE } from '../src/domain/rag/answerPolicy.js';

const fakeStore = () => { const calls = { deleted: [], upserted: [] };
  return { calls, upsert: async r => { calls.upserted.push(...r); }, deleteByIds: async ids => { calls.deleted.push(ids); },
           query: async () => [{ score: 0.9, metadata: { doc: 'a.pdf', ver: '2', sec: 'S', text: 'texte' } }] }; };
const fakeCatalog = () => { const log = [];
  return { log, save: async (p, e) => { log.push(['save', p, e]); return { status: 200 }; },
           remove: async (p, id) => log.push(['remove', p, id]), removeAll: async p => log.push(['removeAll', p]),
           listDocumentIds: async () => ['h1'], list: async () => [] }; };

test('askQuestion : sous le seuil → "Je ne sais pas"', async () => {
  const store = { query: async () => [{ score: 0.1, metadata: {} }] };
  const ask = makeAskQuestion({ embedder: { embed: async () => [[1]] }, vectorStore: store, llm: {}, settings });
  assert.deepEqual(await ask({ question: 'x', project: 'lyon' }), { response: NO_ANSWER_MESSAGE, sources: [] });
});

test('askQuestion : réponse + sources', async () => {
  const ask = makeAskQuestion({ embedder: { embed: async () => [[1]] }, vectorStore: fakeStore(),
    llm: { generate: async () => '  ok  ' }, settings });
  const r = await ask({ question: 'x' });
  assert.equal(r.response, 'ok');
  assert.deepEqual(r.sources[0].slice(0, 3), ['a.pdf', 2, 'S']);
});

test('deleteDocument : 2 paquets de 100 ids + suppression catalogue ; 400 sans nom', async () => {
  const store = fakeStore(), cat = fakeCatalog();
  const del = makeDeleteDocument({ vectorStore: store, catalog: cat, settings });
  await del({ project: 'lyon', docName: 'a.pdf' });
  assert.equal(store.calls.deleted.length, 2);
  assert.equal(store.calls.deleted[1][0].endsWith('_100'), true);
  await assert.rejects(del({ project: 'lyon' }), e => e instanceof ApplicationError && e.status === 400);
});

test('purgeProject : docs catalogue (2 paquets) + 5 legacy (1 paquet) + removeAll', async () => {
  const store = fakeStore(), cat = fakeCatalog();
  await makePurgeProject({ vectorStore: store, catalog: cat, settings })({ project: 'lyon' });
  assert.equal(store.calls.deleted.length, 2 + 5);
  assert.deepEqual(cat.log.at(-1), ['removeAll', 'lyon']);
});

test('ingestDocument : texte brut → upsert + catalogue', async () => {
  const store = fakeStore(), cat = fakeCatalog();
  const ingest = makeIngestDocument({ documentConverter: {}, embedder: { embed: async t => t.map(() => [0.1]) },
    vectorStore: store, catalog: cat, settings, today: () => '01/01/2026' });
  const r = await ingest({ rawText: 'x'.repeat(100), name: 'Doc.xlsx', project: 'Lyon', version: '3' });
  assert.equal(r.ok, true); assert.equal(r.firebaseStatus, 200);
  assert.equal(store.calls.upserted[0].namespace, 'lyon');
  await assert.rejects(ingest({ rawText: 'court', name: 'a' }), e => e.status === 422);
  await assert.rejects(ingest({ name: 'a' }), e => e.status === 400);
});
