#!/usr/bin/env node
/**
 * Test de fumée après déploiement : le Worker et l'application répondent-ils, et correctement ?
 * Variables : WORKER_URL, PAGES_URL, EXPECT_SHA (facultatif : le déploiement servi est-il le bon ?),
 *             SMOKE_EMAIL / SMOKE_PASSWORD (facultatif : compte administrateur DÉDIÉ → vérifie aussi le SQL, donc les migrations).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function smoke({ worker, pages, expectSha, email, password, fetchFn = fetch }) {
  const W = String(worker || '').replace(/\/+$/, ''), P = String(pages || '').replace(/\/+$/, ''), res = [];
  const check = async (name, fn) => { try { res.push({ name, ok: true, detail: (await fn()) || '' }); } catch (e) { res.push({ name, ok: false, detail: e.message }); } };
  const need = (c, m) => { if (!c) throw new Error(m); };
  const get = async (url, init) => { const r = await fetchFn(url, init); return { r, text: await r.text() }; };

  await check('Worker : vivant', async () => { const { r, text } = await get(W + '/'); need(r.status === 200 && JSON.parse(text).status === 'ok', `réponse ${r.status}`); });
  await check('Worker : API configurée (AUTH_SECRET + D1)', async () => {
    const { r } = await get(W + '/api/me'); need(r.status !== 503, 'AUTH_SECRET ou liaison D1 manquante (503)'); need(r.status === 401, `attendu 401 sans jeton, reçu ${r.status}`); });
  await check('Worker : refuse de mauvais identifiants', async () => {
    const { r } = await get(W + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'smoke@invalid.test', password: 'x' }) }); need(r.status === 401, `attendu 401, reçu ${r.status}`); });
  await check('Worker : CORS (pré-requête)', async () => { const { r } = await get(W + '/api/me', { method: 'OPTIONS' }); need(r.status === 200 && /Authorization/.test(r.headers.get('access-control-allow-headers') || ''), 'en-têtes CORS absents'); });
  if (P) {
    await check('Application : page d’accueil', async () => { const { r, text } = await get(P + '/'); need(r.status === 200 && /id="root"/.test(text), `réponse ${r.status}`); });
    await check('Application : modules servis', async () => { for (const f of ['/src/main.js', '/manifest.json', '/icon-512.png']) need((await get(P + f)).r.status === 200, f + ' introuvable'); });
    await check('Application : service worker à jour', async () => { const { r, text } = await get(P + '/sw.js', { cache: 'no-store' }); need(r.status === 200, `réponse ${r.status}`);
      if (expectSha) need(text.includes(`icm-${expectSha.slice(0, 7).toLowerCase()}`), 'le service worker servi ne porte pas le commit déployé'); });
  }
  if (email && password) {
    let token = null, pid = null;
    await check('Connexion du compte de contrôle', async () => { const { r, text } = await get(W + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      need(r.status === 200, `connexion refusée (${r.status})`); const j = JSON.parse(text); token = j.token; pid = (j.projets.find((p) => p.role === 'Admin') || j.projets[0])?.id; need(token && pid, 'aucun projet affecté au compte de contrôle'); });
    if (token) {
      const auth = { headers: { Authorization: 'Bearer ' + token } };
      await check('SQL : chargement du projet', async () => { const { r } = await get(`${W}/api/projets/${pid}/bootstrap`, auth); need(r.status === 200, `réponse ${r.status}`); });
      await check('SQL : indicateurs (migrations à jour)', async () => { const { r, text } = await get(`${W}/api/projets/${pid}/indicateurs?per=7`, auth); need(r.status === 200, `réponse ${r.status} : ${text.slice(0, 120)}`); });
      await check('SQL : conversations (migrations à jour)', async () => { const { r } = await get(`${W}/api/projets/${pid}/discussions`, auth); need(r.status === 200, `réponse ${r.status}`); });
    }
  }
  return res;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const e = process.env;
  if (!e.WORKER_URL) { console.error('WORKER_URL manquante.'); process.exit(2); }
  const out = await smoke({ worker: e.WORKER_URL, pages: e.PAGES_URL, expectSha: e.EXPECT_SHA, email: e.SMOKE_EMAIL, password: e.SMOKE_PASSWORD });
  out.forEach((c) => console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.ok ? '' : ' — ' + c.detail}`));
  const bad = out.filter((c) => !c.ok);
  if (!(e.SMOKE_EMAIL && e.SMOKE_PASSWORD)) console.log('::warning::SMOKE_EMAIL/SMOKE_PASSWORD absents : le SQL (migrations) n’est pas vérifié par le test de fumée.');
  process.exit(bad.length ? 1 : 0);
}
