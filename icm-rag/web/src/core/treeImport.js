/** Import d'une nomenclature d'équipements (Excel / CSV) → arborescence { n, t, kids } : Site › Atelier › Ligne de production › Machine. */
const TYPES = ['Site', 'Atelier', 'Ligne de production', 'Machine'];

/** CSV simple : séparateur détecté (« ; », « , » ou tabulation), guillemets doublés gérés. */
export function parseCsv(text) {
  const t = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const first = t.split('\n')[0] || '';
  const sep = [';', '\t', ','].map((s) => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * Lignes (tableaux, ou objets issus d'une feuille Excel) → arbre. Une ligne = une chaîne complète ; une cellule vide hérite de la ligne
 * précédente (cellules fusionnées). L'en-tête est reconnu et ignoré. Renvoie { tree, count } ou { error } avec le numéro de ligne fautif.
 */
export function treeFromRows(rows) {
  const asArrays = rows.length > 0 && Array.isArray(rows[0]);   // CSV : tableaux (en-tête inclus) ; feuille Excel : objets (en-tête déjà consommé)
  const lines = rows.map((r) => (Array.isArray(r) ? r : Object.values(r)).slice(0, 4).map((c) => String(c == null ? '' : c).trim()));
  const hasHeader = asArrays && !!lines[0] && /^site/i.test(lines[0][0]) && /machine|ligne|atelier/i.test(lines[0].join(' '));
  const skip = hasHeader ? 1 : 0, body = lines.slice(skip), firstNo = asArrays ? skip + 1 : 2;   // firstNo : numéro de la 1re ligne de données dans le fichier
  const tree = []; let prev = ['', '', '', ''], count = 0;
  for (let i = 0; i < body.length; i++) {
    const cells = body[i];
    if (cells.every((c) => !c)) continue;
    const n = firstNo + i;
    // héritage : une cellule vide reprend la valeur du dessus tant qu'aucun niveau supérieur n'a changé
    const cur = []; let changed = false;
    for (let k = 0; k < 4; k++) {
      if (cells[k]) { cur[k] = cells[k]; changed = true; } else cur[k] = changed ? '' : prev[k];
    }
    const filled = cur.filter(Boolean).length;
    if (cur.some((c, k) => !c && cur.slice(k + 1).some(Boolean))) return { error: `Ligne ${n} : un niveau est manquant (attendu : ${TYPES.join(' › ')}).` };
    if (filled === 0) continue;
    let list = tree;
    for (let k = 0; k < 4; k++) {
      if (!cur[k]) break;
      let node = list.find((x) => x.n === cur[k]);
      if (!node) { node = { n: cur[k], t: TYPES[k], kids: [] }; list.push(node); count++; }
      list = node.kids;
    }
    prev = cur;
  }
  if (!tree.length) return { error: 'Aucune ligne exploitable : colonnes attendues « Site ; Atelier ; Ligne de production ; Machine ».' };
  return { tree, count };
}

export const TREE_TEMPLATE_ROWS = [
  ['Site', 'Atelier', 'Ligne de production', 'Machine'],
  ['Site Saint-Priest', 'Atelier conditionnement', 'Ligne 2', 'Convoyeur C-3'],
  ['Site Saint-Priest', 'Atelier conditionnement', 'Ligne 2', 'Moteur M-07'],
  ['Site Saint-Priest', 'Utilités', 'Ligne fluides', 'Pompe P-12'],
];
