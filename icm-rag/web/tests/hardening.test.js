import test from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../src/core/format.js';

test('esc : neutralise aussi l’apostrophe et l’accent grave (évasion d’attribut HTML) ; comportement historique conservé', () => {
  assert.equal(esc(`a'b\`c`), 'a&#39;b&#96;c');
  assert.equal(esc(`<b a="1">&</b>`), '&lt;b a=&quot;1&quot;&gt;&amp;&lt;/b&gt;');
  assert.equal(esc(null), ''); assert.equal(esc(undefined), ''); assert.equal(esc(12), '12');
  const evil = `x' onfocus='alert(1)`;
  assert.ok(!`<input value='${esc(evil)}'>`.includes(`' onfocus='`));
});
