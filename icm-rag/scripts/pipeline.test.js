import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, existsSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { splitSql, migrate, loadMigrations } from './migrate.mjs';
import { stamp } from './stamp-sw.mjs';
import { smoke } from './smoke.mjs';
import { checkRepo } from './check-repo.mjs';
import { checkArchitecture } from './check-architecture.mjs';
import { makeD1 } from '../worker/tests/d1shim.js';
import { buildApp } from '../worker/src/composition/buildApp.js';

const APP = join(fileURLToPath(import.meta.url), '..', '..');
const sqliteExec = (sq) => async (sql) => (/^\s*select/i.test(sql) ? sq.prepare(sql).all() : (sq.prepare(sql).run(), []));
const files = loadMigrations(join(APP, 'worker', 'migrations'));

test('check-repo : le dépôt est cohérent ; icône manquante, module non listé, migration en double et secret sont détectés', () => {
  assert.deepEqual(checkRepo(APP).errors, []);
  const tmp = mkdtempSync(join(tmpdir(), 'icm-check-'));
  try {
    for (const d of ['web', 'worker']) cpSync(join(APP, d), join(tmp, d), { recursive: true, filter: (s) => !/node_modules|\.wrangler/.test(s) });
    rmSync(join(tmp, 'web/icon-512.png'));
    writeFileSync(join(tmp, 'web/src/nouveau.js'), 'export {};');
    writeFileSync(join(tmp, 'worker/migrations/0003_doublon.sql'), 'SELECT 1;');
    writeFileSync(join(tmp, 'worker/leak.md'), 'CLOUDFLARE_API_TOKEN=' + 'a'.repeat(40));
    const e = checkRepo(tmp).errors.join('\n');
    assert.match(e, /liste un fichier absent : \.\/icon-512\.png/); assert.match(e, /manifest\.json : icône absente/);
    assert.match(e, /ne liste pas \.\/src\/nouveau\.js/); assert.match(e, /numéro inattendu 0003_pilotage/); assert.match(e, /leak\.md : jeton Cloudflare/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('splitSql : commentaires retirés, instructions séparées', () => {
  assert.deepEqual(splitSql('-- c\nALTER TABLE a ADD COLUMN b TEXT;\n-- x\nCREATE INDEX i ON a(b);\n'), ['ALTER TABLE a ADD COLUMN b TEXT', 'CREATE INDEX i ON a(b)']);
  assert.equal(splitSql(readFileSync(join(APP, 'worker/migrations/0003_pilotage.sql'), 'utf8')).length, 9);
});

test('migrations : base existante (colonnes ajoutées à la main) → baseline sans erreur ; second passage = rien à faire', async () => {
  const d = makeD1({ seed: false });   // schema.sql + 0002 déjà appliqués par le shim : tout est « déjà présent »
  const r1 = await migrate({ exec: sqliteExec(d.sqlite), files });
  assert.deepEqual([r1.applied.length, r1.baselined.length], [0, 2]);
  const r2 = await migrate({ exec: sqliteExec(d.sqlite), files });
  assert.deepEqual([r2.applied, r2.baselined, r2.skipped.length], [[], [], 2]);
});

test('migrations : base ancienne → colonnes ajoutées ; erreur SQL réelle → arrêt, migration non enregistrée ; dry-run n’écrit rien', async () => {
  const sq = new DatabaseSync(':memory:');
  sq.exec(`CREATE TABLE user (id TEXT PRIMARY KEY); CREATE TABLE discussion (id TEXT PRIMARY KEY, user_id TEXT, projet_id TEXT); CREATE TABLE message (id TEXT PRIMARY KEY, discussion_id TEXT);
    CREATE TABLE note (id TEXT PRIMARY KEY, niveau_utile TEXT, discussion_id TEXT NOT NULL); CREATE TABLE citation (id TEXT PRIMARY KEY, page INTEGER, message_id TEXT NOT NULL);
    CREATE TABLE document_version (id TEXT PRIMARY KEY);`);
  const dry = await migrate({ exec: sqliteExec(sq), files, dryRun: true });
  assert.deepEqual(dry.pending, files.map((f) => f.name)); assert.equal(sq.prepare('SELECT COUNT(*) n FROM _migrations').get().n, 0);
  const r = await migrate({ exec: sqliteExec(sq), files });
  assert.deepEqual(r.applied, files.map((f) => f.name));
  assert.ok(sq.prepare('PRAGMA table_info(note)').all().some((c) => c.name === 'traite_par'));
  const bad = [{ name: '0009_cassee.sql', sql: 'ALTER TABLE inexistante ADD COLUMN x TEXT;' }];
  await assert.rejects(migrate({ exec: sqliteExec(sq), files: bad }), /0009_cassee\.sql/);
  assert.equal(sq.prepare("SELECT COUNT(*) n FROM _migrations WHERE name = '0009_cassee.sql'").get().n, 0);
});

test('stamp-sw : le cache porte le commit ; entrées invalides refusées', () => {
  const sw = readFileSync(join(APP, 'web/sw.js'), 'utf8');
  assert.match(stamp(sw, 'ABCDEF1234567890'), /const CACHE = 'icm-abcdef1';/);
  assert.throws(() => stamp(sw, 'pas-un-sha'), /invalide/);
  assert.throws(() => stamp('rien', 'abcdef1'), /introuvable/);
});

/** Serveur local : Worker réel (routeur + API + SQL) et application statique, pour jouer le test de fumée en conditions réelles. */
async function serve({ withSqlBroken = false } = {}) {
  const db = makeD1(); if (withSqlBroken) db.sqlite.exec('ALTER TABLE note DROP COLUMN suivi_commentaire; DROP INDEX idx_note_discussion;');
  const app = buildApp({ DB: db, AI: {}, VECTORIZE: {}, AUTH_SECRET: 's' }), web = join(APP, 'web');
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    if (req.url.startsWith('/w/')) {
      const r = await app.handle(new Request('http://x' + req.url.slice(2), { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
      res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
    }
    const p = join(web, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (existsSync(p)) { res.writeHead(200, { 'Content-Type': type[extname(p)] || 'text/plain' }); res.end(readFileSync(p)); } else { res.writeHead(404); res.end('absent'); }
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  return { base, worker: base + '/w', pages: base, close: () => server.close() };
}

test('test de fumée : déploiement sain → tout au vert, y compris SQL via le compte de contrôle', async () => {
  const s = await serve();
  try {
    const out = await smoke({ worker: s.worker, pages: s.pages, email: 'admin@usine-lyon.fr', password: 'Changeme!2026' });
    assert.deepEqual(out.filter((c) => !c.ok), []);
    assert.ok(out.length >= 11);
  } finally { s.close(); }
});

test('test de fumée : détecte AUTH_SECRET absent, mauvais commit servi et migration non appliquée', async () => {
  const s = await serve();
  try {
    const stale = await smoke({ worker: s.worker, pages: s.pages, expectSha: 'deadbeef00' });
    assert.deepEqual(stale.filter((c) => !c.ok).map((c) => c.name), ['Application : service worker à jour']);
  } finally { s.close(); }
  const noSecret = buildApp({ DB: makeD1(), AI: {}, VECTORIZE: {} });   // pas d'AUTH_SECRET
  const out = await smoke({ worker: 'http://w', fetchFn: async (u, i) => noSecret.handle(new Request(u, i)) });
  assert.match(out.find((c) => c.name.includes('API configurée')).detail, /AUTH_SECRET/);
  const broken = await serve({ withSqlBroken: true });
  try {
    const o = await smoke({ worker: broken.worker, email: 'admin@usine-lyon.fr', password: 'Changeme!2026' });
    assert.ok(o.some((c) => !c.ok && /migrations/.test(c.name)), 'un SQL en retard sur le code fait échouer le contrôle');
  } finally { broken.close(); }
});

test('architecture : respectée ; chaque règle détecte sa violation sur une copie volontairement dégradée', () => {
  assert.deepEqual(checkArchitecture(APP), []);
  const tmp = mkdtempSync(join(tmpdir(), 'icm-arch-'));
  try {
    for (const d of ['web', 'worker']) cpSync(join(APP, d), join(tmp, d), { recursive: true, filter: (s) => !/node_modules|\.wrangler/.test(s) });
    const add = (f, t) => writeFileSync(join(tmp, f), readFileSync(join(tmp, f), 'utf8') + t);
    add('worker/src/domain/tree.js', "\nimport '../adapters/outbound/d1/d1Repository.js';");
    add('worker/src/application/use-cases/askQuestion.js', "\nimport '../../adapters/outbound/cloudflare/workersAiLlm.js';");
    add('worker/src/adapters/inbound/http/router.js', "\nimport '../../outbound/d1/d1Repository.js';");
    add('worker/src/adapters/outbound/d1/d1Catalog.js', "\nimport '../../inbound/http/router.js';");
    add('web/src/features/assistant/domain/chatReply.js', "\nimport '../../../core/state.js';");
    add('web/src/core/format.js', "\nimport '../features/auth/index.js';");
    add('web/src/features/history/index.js', "\nimport '../accounts/view.js';");
    add('web/src/features/accounts/view.js', "\nimport './actions.js';");
    const e = checkArchitecture(tmp).join('\n');
    for (const r of ['W1', 'W2', 'W3', 'W4', 'F1', 'F2', 'F3', 'F4']) assert.match(e, new RegExp('^::?.*' + r + '|' + r + ' ', 'm'), 'règle non détectée : ' + r);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
