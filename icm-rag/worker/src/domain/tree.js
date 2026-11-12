/** Assemble les 4 listes plates (site/atelier/ligne/machine) en arbre { id, n, t, kids } attendu par l'interface. */
export function buildTree({ sites, ateliers, lignes, machines }) {
  const group = (rows, key) => rows.reduce((m, r) => ((m[r[key]] ||= []).push(r), m), {});
  const byS = group(ateliers, 'site_id'), byA = group(lignes, 'atelier_id'), byL = group(machines, 'ligne_id');
  const node = (r, t, kids = []) => ({ id: r.id, n: r.nom, t, kids });
  return sites.map((s) => node(s, 'Site', (byS[s.id] || []).map((a) => node(a, 'Atelier', (byA[a.id] || []).map((l) =>
    node(l, 'Ligne de production', (byL[l.id] || []).map((m) => node(m, 'Machine'))))))));
}

/** Niveaux de l'arborescence, du plus haut au plus bas (connaissance métier : indépendante de toute base de données). */
export const NODE_TYPES = ['Site', 'Atelier', 'Ligne de production', 'Machine'];

/** Ids des ancêtres d'un nœud, du plus proche au site (ou [] si le nœud n'existe pas ou n'a pas d'ancêtre). */
export function ancestorIds(tree, id) {
  const walk = (list, path) => { for (const n of list) { if (n.id === id) return path; const r = walk(n.kids, [n.id, ...path]); if (r) return r; } return null; };
  return walk(tree, []) || [];
}

/** Ids du nœud et de tous ses descendants (ou [] si le nœud n'existe pas). */
export function subtreeIds(tree, id) {
  const walk = (n) => [n.id, ...n.kids.flatMap(walk)];
  const find = (list) => { for (const n of list) { if (n.id === id) return n; const r = find(n.kids); if (r) return r; } return null; };
  const n = find(tree);
  return n ? walk(n) : [];
}
export const findNodeIn = (tree, id) => { for (const n of tree) { if (n.id === id) return n; const r = findNodeIn(n.kids, id); if (r) return r; } return null; };
