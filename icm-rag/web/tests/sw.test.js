import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Exécute sw.js avec un faux `self` et renvoie ce que le service worker ferait d'une requête. */
function load() {
  const handlers = {}, calls = [];
  const self = { location: { origin: 'https://app.test' }, addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } };
  const caches = { open: async () => ({ put: async () => {}, addAll: async () => {} }), match: async () => undefined, keys: async () => [], delete: async () => {} };
  new Function('self', 'caches', 'fetch', 'Response', readFileSync(new URL('../sw.js', import.meta.url), 'utf8'))(self, caches, async () => { throw new Error('hors ligne'); }, Response);
  return async (url, method = 'GET') => { let out = 'ignored'; handlers.fetch({ request: { url, method }, respondWith: (p) => { out = p; } }); return out === 'ignored' ? out : await out; };
}
test('sw : /api/* et /ingest ne sont jamais interceptés ; ingest.html et les modules le sont (hors-ligne conservé)', async () => {
  const run = await load();
  for (const u of ['/api/me', '/api/projets/lyon/bootstrap', '/ingest']) assert.equal(await run('https://app.test' + u), 'ignored', u);
  assert.equal(await run('https://app.test/x', 'POST'), 'ignored');
  assert.equal(await run('https://autre.test/a.js'), 'ignored');
  for (const u of ['/ingest.html', '/src/main.js', '/']) assert.notEqual(await run('https://app.test' + u), 'ignored', u);
});
test('sw : hors ligne et hors cache → réponse 503 explicite (plus de promesse vide)', async () => {
  const r = await (await load())('https://app.test/src/inconnu.js');
  assert.equal(r.status, 503);
});
