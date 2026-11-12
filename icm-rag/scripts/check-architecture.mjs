#!/usr/bin/env node
/**
 * Contrôle d'architecture : les règles de dépendance entre couches sont vérifiées sur le code (imports statiques ET dynamiques).
 *
 * WORKER (hexagonal)                                         WEB
 *  W1 domain       n'importe que du domain                     F1 features/<x>/domain  n'importe rien (pur, sans DOM ni état)
 *  W2 application  n'importe ni adapters ni composition        F2 core               n'importe ni features ni app
 *  W3 adapters/inbound  n'importe pas adapters/outbound        F3 une fonctionnalité n'importe pas une autre (sauf liaisons déclarées)
 *  W4 adapters/outbound n'importe pas inbound ni composition   F4 une vue (view.js) n'importe pas les actions
 *  W5 seule la composition assemble tout
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Liaisons entre fonctionnalités explicitement admises (le pipeline documentaire est partagé) : consommateur → fournisseur. */
export const FEATURE_LINKS = [['documents', 'ingestion-screen'], ['integration', 'ingestion-screen'], ['projects', 'ingestion-screen'], ['ingestion-screen', 'ingestion']];

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === 'node_modules' || n === 'tests' ? [] : walk(p)) : p.endsWith('.js') ? [p] : []; });
const importsOf = (file) => { const t = readFileSync(file, 'utf8'); return [...t.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)].map((m) => resolve(dirname(file), m[1])); };
const seg = (root, p) => relative(root, p).split(sep);

export function checkArchitecture(app) {
  const errors = [], wsrc = join(app, 'worker', 'src'), fsrc = join(app, 'web', 'src');
  const bad = (file, root, to, rule) => errors.push(`${rule} — ${relative(app, file).split(sep).join('/')} importe ${relative(app, to).split(sep).join('/')}`);

  for (const file of walk(wsrc)) {
    const [layer, sub] = seg(wsrc, file);
    for (const to of importsOf(file)) {
      const [tl, ts] = seg(wsrc, to);
      if (layer === 'domain' && tl !== 'domain') bad(file, wsrc, to, 'W1 le domaine ne dépend que du domaine');
      if (layer === 'application' && ['adapters', 'composition'].includes(tl)) bad(file, wsrc, to, 'W2 l’application ne dépend pas des adaptateurs');
      if (layer === 'adapters' && sub === 'inbound' && tl === 'adapters' && ts === 'outbound') bad(file, wsrc, to, 'W3 un adaptateur entrant ne dépend pas d’un adaptateur sortant');
      if (layer === 'adapters' && sub === 'outbound' && (tl === 'composition' || (tl === 'adapters' && ts === 'inbound'))) bad(file, wsrc, to, 'W4 un adaptateur sortant ne dépend ni de l’entrant ni de la composition');
    }
  }
  for (const file of walk(fsrc)) {
    const s = seg(fsrc, file), top = s[0], feature = top === 'features' ? s[1] : null;
    for (const to of importsOf(file)) {
      const t = seg(fsrc, to), ttop = t[0], tfeature = ttop === 'features' ? t[1] : null;
      if (feature && s[2] === 'domain' && !to.startsWith(dirname(file))) bad(file, fsrc, to, 'F1 un domaine front est pur (aucun import hors de lui-même)');
      if (top === 'core' && (ttop === 'features' || ttop === 'app')) bad(file, fsrc, to, 'F2 le noyau ne dépend ni des fonctionnalités ni de l’application');
      if (feature && tfeature && feature !== tfeature && !FEATURE_LINKS.some(([a, b]) => a === feature && b === tfeature)) bad(file, fsrc, to, 'F3 une fonctionnalité ne dépend pas d’une autre');
      if (feature && s[s.length - 1] === 'view.js' && /actions\.js$/.test(to)) bad(file, fsrc, to, 'F4 une vue n’importe pas les actions');
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkArchitecture(resolve(process.argv[2] || join(fileURLToPath(import.meta.url), '..', '..')));
  errors.forEach((e) => console.log('::error::' + e));
  console.log(errors.length ? `\n✗ ${errors.length} violation(s) d'architecture` : '✓ architecture respectée (couches du Worker, noyau et fonctionnalités du front)');
  process.exit(errors.length ? 1 : 0);
}
