#!/usr/bin/env node
/** Estampille le cache du service worker avec le commit déployé : les navigateurs reçoivent la nouvelle version à chaque déploiement. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stamp(source, sha) {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error('Identifiant de commit invalide : ' + sha);
  if (!/const CACHE = '[^']*';/.test(source)) throw new Error('sw.js : ligne « const CACHE = … » introuvable.');
  return source.replace(/const CACHE = '[^']*';/, `const CACHE = 'icm-${sha.slice(0, 7).toLowerCase()}';`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = resolve(process.argv[3] || 'web/sw.js');
  writeFileSync(file, stamp(readFileSync(file, 'utf8'), process.argv[2] || ''));
  console.log('✓ cache du service worker : icm-' + process.argv[2].slice(0, 7));
}
