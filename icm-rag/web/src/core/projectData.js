import { EMPTY, SEEDS } from './seeds/index.js';
import { JSP, TEMPLATES } from './referentials.js';
import { S } from './state.js';

export function answerWith(qa, q) { const t = q.toLowerCase(); for (const [re, a] of qa) if (re.test(t)) return a; return JSP; }
export function build(seed) {
  const convs = seed.convQs.map((c) => ({ id: c[0], title: c[1], date: c[2], msgs: c[3].flatMap((q, i) => [{ id: c[0] + 'q' + i, u: true, t: q }, Object.assign({ id: c[0] + 'a' + i, u: false }, answerWith(seed.qa, q))]) }));
  return Object.assign(seed, { levels: TEMPLATES[seed.tpl].levels.map((x) => x.slice()), convs, conv: convs[0] ? convs[0].id : null, fb: {}, upSel: seed.files[0] ? seed.files[0].n : null, valSel: seed.val[0] ? seed.val[0].id : null, treeSel: seed.tree[0] ? seed.tree[0].id : null, live: { s: 0, p: 0, n: 0, motifs: [0, 0, 0, 0] } });
}
export const PD = {};
export const D = () => PD[S.project] || (PD[S.project] = build((SEEDS[S.project] || EMPTY)()));
