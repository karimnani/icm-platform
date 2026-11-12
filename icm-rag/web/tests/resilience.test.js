import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, ApiError } from '../src/core/api.js';

const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
const mk = (fetchFn) => createApi({ getBaseUrl: () => 'https://w.test', fetchFn, retryDelayMs: 0 });

test('api : une LECTURE est retentée une fois sur coupure réseau ou 503, puis réussit', async () => {
  let n = 0; const api = mk(async () => { if (++n === 1) throw new TypeError('Failed to fetch'); return res(200, { ok: true, role: 'Admin' }); });
  assert.equal((await api.me()).role, 'Admin'); assert.equal(n, 2);
  n = 0; const api2 = mk(async () => (++n === 1 ? res(503, { error: 'indisponible' }) : res(200, { ok: true })));
  assert.equal((await api2.me()).ok, true); assert.equal(n, 2);
});
test('api : une ÉCRITURE n’est JAMAIS retentée (pas de double intervention)', async () => {
  let n = 0; const api = mk(async () => { n++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(api.createIntervention('lyon', {}), ApiError); assert.equal(n, 1);
  n = 0; const api2 = mk(async () => { n++; return res(503, { error: 'x' }); });
  await assert.rejects(api2.addNode('lyon', {}), (e) => e.status === 503); assert.equal(n, 1);
});
test('api : 401/404/422 et délais dépassés ne sont pas retentés ; la 2e panne est remontée telle quelle', async () => {
  for (const st of [401, 404, 422]) { let n = 0; await assert.rejects(mk(async () => { n++; return res(st, { error: 'non' }); }).me()); assert.equal(n, 1, 'statut ' + st); }
  let n = 0; await assert.rejects(mk(async () => { n++; const e = new Error('abort'); e.name = 'AbortError'; throw e; }).me(), /délai/); assert.equal(n, 1);
  n = 0; await assert.rejects(mk(async () => { n++; throw new TypeError('x'); }).me(), (e) => e.status === 0 && /injoignable/.test(e.message)); assert.equal(n, 2);
});
test('api : hors ligne déclaré par le navigateur → message clair, aucun envoi, aucune nouvelle tentative', async () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  try {
    let n = 0; const api = mk(async () => { n++; return res(200, {}); });
    await assert.rejects(api.me(), (e) => e.status === 0 && /hors ligne/.test(e.message)); assert.equal(n, 0);
  } finally { desc ? Object.defineProperty(globalThis, 'navigator', desc) : delete globalThis.navigator; }
});

// ---------- rendu et gestionnaires (DOM simulé) ----------
let appPromise;
const loadApp = () => (appPromise ||= loadAppOnce());
async function loadAppOnce() {
  const listeners = {}, root = { innerHTML: '', addEventListener: (t, f) => { listeners[t] = f; } };
  globalThis.document = { getElementById: () => root, activeElement: null, createElement: () => ({ setAttribute() {}, style: {}, remove() {} }), body: { appendChild() {} } };
  globalThis.location = { hash: '#connexion' };
  globalThis.window = { addEventListener() {}, scrollTo() {} };
  const render = await import('../src/app/render.js'), router = await import('../src/app/router.js'), reg = await import('../src/app/registry.js');
  const { S } = await import('../src/core/state.js');
  return { root, listeners, render, router, reg, S };
}
test('rendu : un écran qui plante affiche un repli récupérable au lieu de figer l’application', async () => {
  const { root, render, reg } = await loadApp();
  const orig = reg.pages.connexion; const err = console.error; console.error = () => {};
  try {
    reg.pages.connexion = () => { throw new Error('vue cassée <b>'); };
    assert.doesNotThrow(() => render.render());
    assert.match(root.innerHTML, /erreur d’affichage/); assert.match(root.innerHTML, /vue cassée &lt;b&gt;/); assert.match(root.innerHTML, /href="\.\/"/);
    reg.pages.connexion = orig; render.render();
    assert.doesNotMatch(root.innerHTML, /erreur d’affichage/);   // l'écran normal revient dès que la cause disparaît
  } finally { reg.pages.connexion = orig; console.error = err; }
});
test('gestionnaires : exception synchrone ou promesse rejetée → bandeau d’erreur (S.err), écriture débloquée, pas de blocage', async () => {
  const { listeners, router, reg, S } = await loadApp();
  const err = console.error; console.error = () => {};
  try {
    router.installRouter();
    const btn = (act) => ({ target: { closest: () => ({ tagName: 'BUTTON', disabled: false, dataset: { act } }) } });
    reg.actions.__boom = () => { throw new Error('échec sync'); };
    reg.actions.__rej = () => Promise.reject(new Error('échec async'));
    S.busy = true; S.err = '';
    assert.doesNotThrow(() => listeners.click(btn('__boom')));
    assert.match(S.err, /échec sync/); assert.equal(S.busy, false);
    S.err = ''; listeners.click(btn('__rej')); await new Promise((r) => setTimeout(r, 5));
    assert.match(S.err, /échec async/);
    reg.actions.__ok = () => { S.err = 'intact'; };
    listeners.click(btn('__ok')); assert.equal(S.err, 'intact');   // chemin nominal inchangé
  } finally { delete reg.actions.__boom; delete reg.actions.__rej; delete reg.actions.__ok; console.error = err; }
});
