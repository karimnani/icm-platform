#!/usr/bin/env node
/**
 * Migrations D1 suivies et idempotentes (table `_migrations`).
 *  - une migration déjà enregistrée n'est jamais rejouée ;
 *  - base existante dont les colonnes ont été ajoutées À LA MAIN (0002, 0003 appliquées avant ce pipeline) : l'erreur « duplicate column »
 *    est reconnue, la migration est marquée « baseline » et la suite continue — le premier passage du pipeline ne casse donc rien ;
 *  - toute autre erreur SQL interrompt tout (la migration fautive n'est pas enregistrée).
 * Usage : node scripts/migrate.mjs [--dry-run]   (variables : D1_DATABASE, défaut « icm-database » ; lancé depuis le dossier du dépôt applicatif)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Découpe un script SQL en instructions (commentaires `--` retirés). */
export const splitSql = (sql) => sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n').split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
// const ALREADY = /duplicate column name|already exists/i;
const ALREADY = /duplicate column name|already exists|code["':\s]+7500|duplicate/i;
export async function migrate({ exec, files, dryRun = false, log = () => {} }) {
  await exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, baseline INTEGER DEFAULT 0)');
  const done = new Set((await exec('SELECT name FROM _migrations')).map((r) => r.name));
  const out = { applied: [], baselined: [], skipped: [], pending: [] };
  for (const f of files) {
    if (done.has(f.name)) { out.skipped.push(f.name); continue; }
    if (dryRun) { out.pending.push(f.name); continue; }
    let baseline = false;
    for (const stmt of splitSql(f.sql)) {
      try { await exec(stmt); }
      catch (e) { if (ALREADY.test(String(e.message || e))) baseline = true; else throw new Error(`${f.name} : ${e.message || e}\n  → ${stmt.slice(0, 120)}`); }
    }
    await exec(`INSERT INTO _migrations (name, baseline) VALUES ('${f.name.replace(/'/g, "''")}', ${baseline ? 1 : 0})`);
    (baseline ? out.baselined : out.applied).push(f.name);
    log(`${baseline ? '≈ déjà présente (baseline)' : '✓ appliquée'} : ${f.name}`);
  }
  return out;
}

export const loadMigrations = (dir) => readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }));

/** Exécuteur réel : `wrangler d1 execute --remote --json` (sans shell : aucune injection possible via les arguments). */
export function wranglerExec(database, cwd) {
  return async (sql) => {
    let out;
    try { out = execFileSync('npx', ['--yes', process.env.WRANGLER_PKG || 'wrangler@3', 'd1', 'execute', database, '--remote', '--json', '--command', sql], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { throw new Error(String(e.stderr || e.stdout || e.message).trim().split('\n').slice(-6).join(' ')); }
    const json = JSON.parse(out.slice(out.indexOf('[')));
    return json[0]?.results || [];
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = resolve(fileURLToPath(import.meta.url), '..', '..'), dryRun = process.argv.includes('--dry-run');
  const r = await migrate({ exec: wranglerExec(process.env.D1_DATABASE || 'icm-database', join(app, 'worker')), files: loadMigrations(join(app, 'worker', 'migrations')), dryRun, log: console.log });
  console.log(dryRun ? `À appliquer : ${r.pending.join(', ') || 'rien'}` : `Terminé — appliquées : ${r.applied.length}, baseline : ${r.baselined.length}, déjà faites : ${r.skipped.length}`);
}
