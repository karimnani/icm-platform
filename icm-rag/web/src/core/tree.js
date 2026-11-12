import { D } from './projectData.js';

export function flat(list, depth = 0, path = [], out = []) { list.forEach((n) => { const p = path.concat(n.n); out.push({ n, depth, path: p }); flat(n.kids, depth + 1, p, out); }); return out; }
export const findNode = (id) => flat(D().tree).find((x) => x.n.id === id);
export const pathOf = (id) => { const f = findNode(id); return f ? f.path.join(' › ') : 'Non rattaché'; };
export const descIds = (id) => { const f = findNode(id); return f ? flat([f.n]).map((x) => x.n.id) : []; };
export function parentList(id, list = D().tree) { for (const n of list) { if (n.id === id) return list; const r = parentList(id, n.kids); if (r) return r; } return null; }
export const nodeOpts = (onlyType) => flat(D().tree).filter((x) => !onlyType || x.n.t === onlyType).map((x) => [x.n.id, (onlyType ? '' : ' '.repeat(x.depth)) + x.n.n + (onlyType ? ' (' + x.path[x.path.length - 2] + ')' : ' (' + x.n.t + ')')]);
export const levelNames = () => D().levels.map((l) => l[0]);
export function childTypes(parentType) {
  const L = D().levels, i = parentType ? L.findIndex((l) => l[0] === parentType) : -1;
  const out = []; for (let k = i + 1; k < L.length; k++) { out.push(L[k][0]); if (!L[k][1]) break; } return out;
}
