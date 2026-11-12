#!/usr/bin/env node
/**
 * Point de contrôle « cohérence du dépôt » (exécuté par la CI avant tout test et avant tout déploiement).
 * Échoue (code 1) avec la liste précise des anomalies ; aucune dépendance.
 *   1. sw.js : chaque fichier listé existe (sinon cache.addAll échoue et le service worker ne s'installe jamais)
 *   2. sw.js : chaque module de src/ et chaque feuille de style est listé (sinon le mode hors-ligne casse)
 *   3. manifest.json : les icônes déclarées existent
 *   4. migrations : numérotation continue 0002, 0003… et schema.sql présent
 *   5. secrets : aucun secret de déploiement ni AUTH_SECRET en clair dans le dépôt
 *   6. wrangler.toml : liaisons attendues (AI, VECTORIZE, DB)
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkRepo(root) {
  const errors = [], warnings = [];
  const web = join(root, 'web'), worker = join(root, 'worker');
  const read = (p) => readFileSync(p, 'utf8');
  const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const rel = (base, p) => './' + relative(base, p).split(sep).join('/');

  // 1 + 2 : service worker
  const sw = read(join(web, 'sw.js')), block = sw.match(/const FILES = \[([\s\S]*?)\];/);
  if (!block) errors.push('web/sw.js : liste FILES introuvable.');
  else {
    const listed = [...block[1].replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    for (const f of listed) if (f !== './' && !existsSync(join(web, f))) errors.push(`web/sw.js liste un fichier absent : ${f}`);
    const mustList = [...walk(join(web, 'src')).filter((p) => /\.(js|css)$/.test(p)), ...walk(join(web, 'css')), join(web, 'index.html')].map((p) => rel(web, p));
    for (const f of mustList) if (!listed.includes(f)) errors.push(`web/sw.js ne liste pas ${f} (hors-ligne incomplet)`);
  }
  // 3 : manifest
  try { for (const i of JSON.parse(read(join(web, 'manifest.json'))).icons || []) if (!existsSync(join(web, i.src))) errors.push(`manifest.json : icône absente ${i.src}`); }
  catch (e) { errors.push('web/manifest.json illisible : ' + e.message); }
  // 4 : migrations
  if (!existsSync(join(worker, 'schema.sql'))) errors.push('worker/schema.sql absent.');
  const mig = existsSync(join(worker, 'migrations')) ? readdirSync(join(worker, 'migrations')).filter((f) => f.endsWith('.sql')).sort() : [];
  mig.forEach((f, i) => { const n = Number(f.slice(0, 4)); if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(f)) errors.push(`migration mal nommée : ${f} (attendu 0004_nom.sql)`); else if (n !== i + 2) errors.push(`migrations : numéro inattendu ${f} (attendu ${String(i + 2).padStart(4, '0')}) — pas de trou ni de doublon`); });
  // 5 : secrets
  const skip = /(^|[\\/])(node_modules|\.git|\.wrangler)([\\/]|$)/;
  const bad = [[/CLOUDFLARE_API_TOKEN\s*[:=]\s*['"]?[A-Za-z0-9_-]{30,}/, 'jeton Cloudflare'], [/AUTH_SECRET\s*=\s*['"][^'"]{8,}['"]/, 'AUTH_SECRET en clair'], [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'clé privée']];
  for (const p of walk(root).filter((p) => !skip.test(p) && /\.(js|mjs|json|toml|ya?ml|md|sql|html)$/.test(p) && statSync(p).size < 2e6)) {
    if (/check-repo\.mjs$|\.test\.js$/.test(p)) continue;
    const t = read(p); for (const [re, label] of bad) if (re.test(t)) errors.push(`${rel(root, p)} : ${label} détecté`);
  }
  // 6 : wrangler
  if (existsSync(join(worker, 'wrangler.toml'))) { const w = read(join(worker, 'wrangler.toml')); for (const b of ['binding = "AI"', 'binding = "VECTORIZE"', 'binding = "DB"']) if (!w.includes(b)) errors.push(`wrangler.toml : liaison manquante (${b})`); }
  else errors.push('worker/wrangler.toml absent.');
  if (/Changeme!2026/.test(read(join(worker, 'seed.sql')))) warnings.push('seed.sql : comptes de démonstration (« Changeme!2026 ») — ne jamais appliquer seed.sql en production sans changer ces mots de passe.');
  return { errors, warnings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || join(fileURLToPath(import.meta.url), '..', '..'));
  const { errors, warnings } = checkRepo(root);
  warnings.forEach((w) => console.log('::warning::' + w));
  errors.forEach((e) => console.log('::error::' + e));
  console.log(errors.length ? `\n✗ ${errors.length} anomalie(s)` : '✓ dépôt cohérent');
  process.exit(errors.length ? 1 : 0);
}
