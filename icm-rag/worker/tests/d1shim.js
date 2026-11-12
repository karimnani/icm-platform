/** Imite l'API D1 (prepare/bind/all/first/run/batch) au-dessus de node:sqlite, pour tester le VRAI SQL sans Cloudflare. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function makeD1({ seed = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const here = (f) => new URL('../' + f, import.meta.url);
  sqlite.exec(readFileSync(here('schema.sql'), 'utf8'));
  sqlite.exec(readFileSync(here('migrations/0002_catalogue_columns.sql'), 'utf8'));
  if (seed) sqlite.exec(readFileSync(here('seed.sql'), 'utf8'));
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    run: async () => { sqlite.prepare(sql).run(...params); return { success: true }; },
    _exec: () => sqlite.prepare(sql).run(...params),
  });
  return {
    sqlite,
    prepare: (sql) => stmt(sql),
    batch: async (list) => { sqlite.exec('BEGIN'); try { for (const s of list) s._exec(); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } return []; },
  };
}
