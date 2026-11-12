import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkMarkdown } from '../src/domain/text/chunker.js';
import { clean, slug, documentHash } from '../src/domain/text/identifiers.js';
import { vectorIdRange } from '../src/domain/document/vectorIds.js';

test('clean / slug', () => {
  assert.equal(clean('Lyon !'), 'lyon');
  assert.equal(slug('Guide Maintenance é.pdf'), 'guide-maintenance-e.pdf');
});

test('documentHash stable, 12 hex', async () => {
  const h = await documentHash('lyon', 'guide-maintenance.pdf');
  assert.match(h, /^[0-9a-f]{12}$/);
  assert.equal(h, await documentHash('lyon', 'guide-maintenance.pdf'));
});

test('chunker garde les sections et applique le recouvrement', () => {
  const md = '# Titre A\n\n' + 'a'.repeat(900) + '\n\n# Titre B\n\n' + 'b'.repeat(900);
  const chunks = chunkMarkdown(md, { size: 1500, overlap: 200 });
  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].section, 'Titre A');
});

test('vectorIdRange', () => {
  assert.deepEqual(vectorIdRange('abc', 100, 3), ['abc_100', 'abc_101', 'abc_102']);
});
