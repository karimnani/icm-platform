import test from 'node:test';
import assert from 'node:assert/strict';
import { spreadsheetToMarkdown } from '../src/features/ingestion/domain/spreadsheetMarkdown.js';
import { formatServerReply } from '../src/features/ingestion/domain/serverReply.js';
import { toDocumentSummary } from '../src/features/ingestion/domain/documentSummary.js';

test('spreadsheetToMarkdown', () => {
  const md = spreadsheetToMarkdown({ sheetNames: ['S1', 'S2'],
    rowsOf: n => n === 'S1' ? [{ a: 1, b: 'x' }] : [], csvOf: () => 'c1,c2\n1,2' }, 'f.xlsx');
  assert.equal(md, '# Document : f.xlsx\n\n## Feuille : S1\n\nLigne 1 : a: 1 | b: x\n\n## Feuille : S2\n\nc1,c2\n1,2\n\n');
});
test('formatServerReply', () => {
  assert.equal(formatServerReply({ status: 200, text: '{"a":1}' }), '{\n  "a": 1\n}');
  assert.equal(formatServerReply({ status: 502, text: 'oops' }), '502 oops');
});
test('toDocumentSummary défauts', () => {
  assert.deepEqual(toDocumentSummary({}), { title: 'Document', version: 1, chunks: '—', date: '—' });
});
