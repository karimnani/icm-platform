/**
 * Contrat Assistant ⇄ Worker : la passerelle du front est branchée sur le VRAI routeur du Worker
 * (seuls Workers AI et Vectorize sont remplacés par des faux). Garantit que POST / { action:'chat' }
 * produit bien une réponse que le front sait afficher.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../../worker/src/adapters/inbound/http/router.js';
import { createHttpHandlers } from '../../worker/src/adapters/inbound/http/handlers.js';
import { makeAskQuestion } from '../../worker/src/application/use-cases/askQuestion.js';
import { settings } from '../../worker/src/config/constants.js';
import { createWorkerChatGateway } from '../src/features/assistant/adapters/workerChatGateway.js';
import { toAssistantMessage } from '../src/features/assistant/domain/chatReply.js';

const hits = [
  { score: 0.82, metadata: { doc: 'Procédure pompe P-12.pdf', ver: '3', sec: '3. Graissage des paliers', text: 'Graisser les paliers toutes les 500 heures avec de la graisse EP2.' } },
  { score: 0.12, metadata: { doc: 'Hors-sujet.pdf', ver: '1', sec: 'Intro', text: 'bruit' } },
];
function workerFetch({ matches = hits, llm = async () => 'Toutes les 500 heures (EP2).', embed = async () => [[0.1, 0.2]] } = {}) {
  const seen = { namespaces: [] };
  const ask = makeAskQuestion({ embedder: { embed }, vectorStore: { query: async (v, o) => { seen.namespaces.push(o.namespace); return matches; } }, llm: { generate: llm }, settings });
  const noop = async () => { throw new Error('non utilisé'); };
  const router = createRouter(createHttpHandlers({ ingestDocument: noop, listDocuments: noop, deleteDocument: noop, purgeProject: noop, askQuestion: ask }));
  const fetchFn = async (url, init) => {
    const res = await router(new Request(url, init));
    return { ok: res.ok, status: res.status, text: () => res.text(), headers: res.headers };
  };
  return { fetchFn, seen };
}
const gateway = (fetchFn) => createWorkerChatGateway({ getBaseUrl: () => 'https://icm-maser.example.workers.dev/', fetchFn });

test('contrat : réponse sourcée, seuil de pertinence appliqué, projet transmis comme espace Vectorize', async () => {
  const { fetchFn, seen } = workerFetch();
  const msg = toAssistantMessage(await gateway(fetchFn).ask({ question: 'Fréquence de graissage ?', project: 'lyon' }));
  assert.equal(msg.t, 'Toutes les 500 heures (EP2).');
  assert.equal(msg.src.length, 1, 'le passage sous le seuil MIN_SCORE est écarté par le Worker');
  assert.deepEqual(msg.src[0].slice(0, 3), ['Procédure pompe P-12.pdf', 3, '3. Graissage des paliers']);
  assert.match(msg.src[0][3], /^« Graisser les paliers/);
  assert.deepEqual(seen.namespaces, ['lyon']);
});
test('contrat : aucun passage pertinent → « Je ne sais pas » sans source', async () => {
  const { fetchFn } = workerFetch({ matches: [{ score: 0.05, metadata: {} }] });
  const msg = toAssistantMessage(await gateway(fetchFn).ask({ question: 'x', project: 'lyon' }));
  assert.match(msg.t, /^Je ne sais pas/); assert.deepEqual(msg.src, []);
});
test('contrat : erreur interne du Worker (500) → ChatError lisible côté front', async () => {
  const { fetchFn } = workerFetch({ llm: async () => { throw new Error('modèle indisponible'); } });
  await assert.rejects(gateway(fetchFn).ask({ question: 'x', project: 'lyon' }), /500 : modèle indisponible/);
});
test('contrat : question vide → message du Worker affiché tel quel', async () => {
  const { fetchFn } = workerFetch();
  const msg = toAssistantMessage(await gateway(fetchFn).ask({ question: '', project: 'lyon' }));
  assert.equal(msg.t, 'Posez une question.');
});
