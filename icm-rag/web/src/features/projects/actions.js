import { S } from '../../core/state.js';
import { TODAY, val } from '../../core/format.js';
import { findNode } from '../../core/tree.js';
import { api } from '../../core/api.js';
import { mutate, openProject } from '../../core/remote.js';
import { download, toCsv } from '../../core/download.js';
import { readSheetRows } from '../ingestion-screen/upload.js';
import { parseCsv, treeFromRows, TREE_TEMPLATE_ROWS } from '../../core/treeImport.js';

const ERR = { errKey: 'treeMsg' };

/** Lit un fichier CSV ou Excel (1re feuille) et renvoie les lignes de la nomenclature. */
async function readRows(file) {
  if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
  return readSheetRows(file);
}

/** Import réel : lecture du fichier → arbre → API (le Worker vérifie les niveaux) → rechargement. */
async function importFile(file, d, render) {
  S.treeMsg = ''; S.importMsg = '';
  try {
    const r = treeFromRows(await readRows(file));
    if (r.error) { S.treeMsg = r.error; render(); return; }
    if (d.tree.length && typeof confirm === 'function' && !confirm(`L'arborescence contient déjà des éléments : ajouter ces ${r.count} éléments à la suite ?`)) return;
    mutate(() => api.importTree(S.project, r.tree), render, { errKey: 'treeMsg', after: () => { S.importMsg = `${file.name} importé : ${r.count} élément(s) ajouté(s). Vérifiez l’arborescence ci-dessous.`; } });
  } catch (e) { S.treeMsg = 'Fichier illisible : ' + (e.message || e); render(); }
}

export const actions = {
  projform: () => { S.projForm = !S.projForm; S.projErr = false; },
  openproj: ({ v, render }) => { openProject(v, render); return false; },
  tsel: ({ v, d }) => { d.treeSel = v; S.treeMsg = ''; },
  addsite: ({ d, render }) => { mutate(() => api.addNode(S.project, { type: d.levels[0][0], nom: 'Nouveau site' }), render, { ...ERR, after: (r) => { d.treeSel = r.id; } }); return false; },
  tadd: ({ d, render }) => {
    const name = val('tadn').trim(); if (!name) { S.treeMsg = 'Saisissez un nom avant d’ajouter.'; return; }
    const p = findNode(d.treeSel);
    mutate(() => api.addNode(S.project, { type: val('tadt'), nom: name, parent_id: p.n.id }), render, { ...ERR, after: (r) => { d.treeSel = r.id; } }); return false;
  },
  trename: ({ d, render }) => { const name = val('tren').trim(); if (!name) return; mutate(() => api.renameNode(S.project, d.treeSel, name), render, ERR); return false; },
  tdel: ({ d, render }) => {
    const sel = d.treeSel, n = findNode(sel);
    if (typeof confirm === 'function' && !confirm(`Supprimer « ${n ? n.n.n : 'cet élément'} » et tout ce qu'il contient ?`)) return false;   // le Worker refuse si des documents ou interventions sont rattachés (message renvoyé tel quel)
    mutate(() => api.deleteNode(S.project, sel), render, ERR); return false;
  },
  xlsmodel: () => { download('modele_nomenclature_equipements.csv', toCsv(TREE_TEMPLATE_ROWS), 'text/csv;charset=utf-8'); return false; },
};

export const submits = {
  projcreate: ({ render }) => {
    const n = val('pn').trim(); if (!n) { S.projErr = true; return; }
    (async () => {
      try {
        const { projet } = await api.createProject(n);
        S.projects.push({ id: projet.id, n, date: TODAY }); S.roles[projet.id] = 'admin'; S.projForm = false; S.projErr = false;
        await openProject(projet.id, render);
      } catch (e) { S.err = e.message; render(); }
    })();
    return false;
  },
};

export const changes = {
  treefile: ({ t, d, render }) => { const f = t.files && t.files[0]; t.value = ''; if (f) importFile(f, d, render); return false; },
  project: ({ v, render }) => { openProject(v, render); return false; },
};
