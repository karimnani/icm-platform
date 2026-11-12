import test from 'node:test';
import assert from 'node:assert/strict';
import { toAssistantMessage, sourceLocator, signalLocator, describeFailure, ChatError } from '../src/features/assistant/domain/chatReply.js';
import { createWorkerChatGateway } from '../src/features/assistant/adapters/workerChatGateway.js';
import { createAssistant } from '../src/features/assistant/conversation.js';
import { S } from '../src/core/state.js';
import { D } from '../src/core/projectData.js';

/* ---------- domaine ---------- */
test('toAssistantMessage : réponse avec sources', () => {
  const m = toAssistantMessage({ response: '  Graisser toutes les 500 h.  ', sources: [['Procédure.pdf', 3, '3. Graissage', '« extrait… »']] });
  assert.deepEqual(m, { t: 'Graisser toutes les 500 h.', src: [['Procédure.pdf', 3, '3. Graissage', '« extrait… »']] });
});
test('toAssistantMessage : « je ne sais pas » sans source, version et section absentes', () => {
  assert.deepEqual(toAssistantMessage({ response: 'Je ne sais pas.', sources: [] }), { t: 'Je ne sais pas.', src: [] });
  assert.deepEqual(toAssistantMessage({ response: 'ok' }), { t: 'ok', src: [] });
  assert.deepEqual(toAssistantMessage({ response: 'ok', sources: [['a.pdf'], null, ['', 1]] }).src, [['a.pdf', 1, '', '']]);
});
test('toAssistantMessage : erreurs', () => {
  assert.throws(() => toAssistantMessage(null), ChatError);
  assert.throws(() => toAssistantMessage({ error: 'boom' }), /boom/);
  assert.throws(() => toAssistantMessage({ response: '   ' }), /vide/);
});
test('sourceLocator / signalLocator : page numérique ou titre de section', () => {
  assert.equal(sourceLocator(4), 'page 4');
  assert.equal(sourceLocator('12'), 'page 12');
  assert.equal(sourceLocator('3. Graissage des paliers'), 'section « 3. Graissage des paliers »');
  assert.equal(sourceLocator('—'), '');
  assert.equal(sourceLocator(''), '');
  assert.equal(signalLocator(4), ' · p. 4');
  assert.equal(signalLocator('Introduction'), ' · § Introduction');
  assert.equal(signalLocator('—'), '');
});
test('describeFailure', () => {
  assert.equal(describeFailure(new ChatError('Serveur muet')), 'Serveur muet');
  assert.match(describeFailure(new TypeError('x')), /Erreur inattendue : x/);
});

/* ---------- passerelle HTTP ---------- */
const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
test('passerelle : requête POST / { action:"chat", question, project }', async () => {
  let seen;
  const gw = createWorkerChatGateway({ getBaseUrl: () => ' https://w.example/// ', fetchFn: async (url, init) => { seen = { url, init }; return reply({ response: 'r', sources: [] }); } });
  assert.deepEqual(await gw.ask({ question: 'Q ?', project: 'lyon' }), { response: 'r', sources: [] });
  assert.equal(seen.url, 'https://w.example/');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.init.body), { action: 'chat', question: 'Q ?', project: 'lyon' });
});
test('passerelle : adresse vide, erreur HTTP, corps non JSON, réseau coupé', async () => {
  const ask = (fetchFn, base = () => 'https://w.example') => createWorkerChatGateway({ getBaseUrl: base, fetchFn }).ask({ question: 'q', project: 'p' });
  await assert.rejects(ask(async () => reply({}), () => ''), /adresse du serveur/);
  await assert.rejects(ask(async () => reply({ error: 'IA indisponible' }, 500)), /500 : IA indisponible/);
  await assert.rejects(ask(async () => reply('<html>502</html>', 502)), /502/);
  assert.equal(await ask(async () => reply('pas du json')), null); // laissé à toAssistantMessage, qui refuse null
  await assert.rejects(ask(async () => { throw new TypeError('Failed to fetch'); }), /injoignable/);
});
test('passerelle : délai dépassé', async () => {
  const slow = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const gw = createWorkerChatGateway({ getBaseUrl: () => 'https://w.example', fetchFn: slow, timeoutMs: 20 });
  await assert.rejects(gw.ask({ question: 'q', project: 'p' }), /délai/);
});

/* ---------- conversation (état en mémoire, sans DOM) ---------- */
const fakeGateway = (impl) => { const calls = []; return { calls, ask: async (a) => { calls.push(a); return impl(a, calls.length); } }; };
const freshProject = (id) => { S.project = id; S.chat.draft = ''; const d = D(); d.convs.length = 0; d.conv = null; return d; };

test('conversation : question → réponse en attente → réponse, dans le projet actif', async () => {
  const d = freshProject('lyon');
  const gw = fakeGateway(async () => ({ response: 'Toutes les 500 h.', sources: [['Procédure pompe P-12.pdf', 3, '3. Graissage', 'x']] }));
  const states = [];
  const done = createAssistant({ gateway: gw }).ask('  Quelle fréquence ?  ', () => { const c = d.convs[0]; states.push(c.msgs.map((m) => (m.u ? 'U' : m.pending ? 'attente' : m.err ? 'erreur' : 'réponse'))); });
  assert.deepEqual(states, [['U', 'attente']], 'la bulle « en attente » est affichée sans attendre le réseau');
  await done;
  assert.deepEqual(states.at(-1), ['U', 'réponse']);
  const [u, a] = d.convs[0].msgs;
  assert.equal(u.t, 'Quelle fréquence ?');
  assert.equal(a.t, 'Toutes les 500 h.');
  assert.equal(a.src[0][0], 'Procédure pompe P-12.pdf');
  assert.equal(d.convs[0].title, 'Quelle fréquence ?');
  assert.deepEqual(gw.calls, [{ question: 'Quelle fréquence ?', project: 'lyon' }]);
});
test('conversation : le projet de la question est celui du moment où elle est posée', async () => {
  const d = freshProject('lyon');
  let release; const gate = new Promise((r) => { release = r; });
  const gw = fakeGateway(async () => { await gate; return { response: 'ok', sources: [] }; });
  const projectsSeen = [];
  const done = createAssistant({ gateway: gw }).ask('q', (p) => projectsSeen.push(p));
  S.project = 'grenoble'; // l'utilisateur change de projet pendant l'attente
  release(); await done;
  assert.equal(gw.calls[0].project, 'lyon');
  assert.deepEqual(projectsSeen, ['lyon', 'lyon']);
  assert.equal(d.convs[0].msgs[1].t, 'ok');
  S.project = 'lyon';
});
test('conversation : échec réseau → message d’erreur, puis « Réessayer »', async () => {
  const d = freshProject('lyon');
  const gw = fakeGateway(async (a, n) => { if (n === 1) throw new ChatError('Serveur RAG injoignable.'); return { response: 'Enfin.', sources: [] }; });
  const as = createAssistant({ gateway: gw });
  await as.ask('Une question');
  const a = d.convs[0].msgs[1];
  assert.equal(a.err, 'Serveur RAG injoignable.'); assert.equal(a.pending, false); assert.deepEqual(a.src, []);
  await as.retry(a.id);
  assert.equal(a.err, ''); assert.equal(a.t, 'Enfin.');
  assert.equal(d.convs[0].msgs.length, 2, 'le réessai remplace la réponse, il n’ajoute pas de message');
  assert.equal(gw.calls[1].question, 'Une question');
  assert.equal(as.retry(a.id), null, 'rien à réessayer quand la réponse a réussi');
});
test('conversation : une question à la fois, question vide ignorée', async () => {
  const d = freshProject('lyon');
  let release; const gate = new Promise((r) => { release = r; });
  const gw = fakeGateway(async () => { await gate; return { response: 'ok', sources: [] }; });
  const as = createAssistant({ gateway: gw });
  assert.equal(as.ask('   '), null);
  const first = as.ask('première');
  assert.equal(as.ask('seconde'), null, 'refusée tant que la première attend');
  release(); await first;
  assert.equal(gw.calls.length, 1); assert.equal(d.convs[0].msgs.length, 2);
});
test('conversation : sans conversation ouverte, en crée une', async () => {
  const d = freshProject('p-nouveau');
  const gw = fakeGateway(async () => ({ response: 'Je ne sais pas.', sources: [] }));
  await createAssistant({ gateway: gw }).ask('Une très très longue question de plus de trente-quatre caractères');
  assert.equal(d.convs.length, 1);
  assert.equal(d.convs[0].title, 'Une très très longue question de p…', 'titre = 34 premiers caractères + …');
  assert.equal(d.conv, d.convs[0].id);
  S.project = 'lyon';
});
