import { D, PD } from '../../core/projectData.js';
import { EMPTY, SEEDS } from '../../core/seeds/index.js';
import { LEVEL_EX } from '../../core/referentials.js';
import { S, projName } from '../../core/state.js';
import { childTypes, flat, levelNames } from '../../core/tree.js';
import { esc, opt } from '../../core/format.js';
import { ic } from '../../core/icons.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

pages.projets = () => {
  const d = D(), rows = flat(d.tree), sel = rows.find((x) => x.n.id === d.treeSel);
  const docsAt = (id) => d.docs.filter((x) => x.node === id).length;
  const types = childTypes(sel ? sel.n.t : null);
  const counts = levelNames().map((l) => [l, rows.filter((x) => x.n.t === l).length]);
  const projList = `<section class="card" style="gap:12px"><div class="head"><h2>Projets</h2><button class="btn sm" data-act="projform">${ic('plus', 16)}Créer un projet</button></div>
    <p class="hint" style="margin:0">Chaque projet correspond à un périmètre industriel (un ou plusieurs sites). Les documents, comptes et connaissances d'un projet ne sont pas visibles dans les autres.</p>
    ${S.projForm ? `<form data-act="projcreate" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end" novalidate><div class="field" style="flex:1 1 220px"><label for="pn">Nom du projet</label><input id="pn" class="in" placeholder="Usine de Toulouse"></div>
      <button class="btn" type="submit">Créer</button>${S.projErr ? '<span role="alert" style="font-size:14px;font-weight:600;color:var(--kox)">Renseignez le nom du projet.</span>' : ''}</form>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">${S.projects.map((p) => { const pd = PD[p.id] || (SEEDS[p.id] ? SEEDS[p.id]() : EMPTY()); const sites = (pd.tree || []).length;
      return `<button class="pill${p.id === S.project ? ' on' : ''}" style="border-radius:10px;min-height:56px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;padding:6px 14px" data-act="openproj" data-v="${p.id}"><b style="font-weight:600">${esc(p.n)}</b><span style="font-size:12px;opacity:.85">${sites} site${sites > 1 ? 's' : ''} · ${(pd.docs || []).length} documents</span></button>`; }).join('')}</div></section>`;
  const levelsCard = `<section class="card" style="gap:12px"><div class="head"><div><h2>Niveaux de l'arborescence</h2><p class="hint" style="margin:4px 0 0">Structure identique pour tous les projets : Site › Atelier › Ligne de production › Machine. Les quatre niveaux sont obligatoires.</p></div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${d.levels.map((l, i) => `<div style="border:1px solid var(--bd);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b style="font-weight:600">${i + 1}. ${esc(l[0])}</b><span class="muted" style="font-size:13px">${(counts.find((c) => c[0] === l[0]) || [0, 0])[1]}</span></div>
      <span class="hint"><b style="font-weight:600;color:var(--tx)">Documents attendus :</b> ${(LEVEL_EX[l[0]] || ['À définir']).join(', ')}</span></div>`).join('')}</div></section>`;
  const treeCard = `<section class="card" style="flex:3 1 460px;gap:12px"><div class="head"><h2>Arborescence de ${esc(projName())}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn sec sm pick">${ic('xls', 16)}Importer (Excel ou CSV)<input class="sr" type="file" accept=".xlsx,.xls,.csv" data-input="treefile"></label><button class="btn ghost sm" data-act="xlsmodel">${ic('down', 16)}Modèle (CSV pour Excel)</button></div></div>
    ${S.importMsg ? `<div class="alert t-ok" role="status">${S.importMsg}</div>` : ''}
    ${rows.length ? `<div role="tree" style="display:flex;flex-direction:column;gap:2px">${rows.map((x) => `<button role="treeitem" class="tree-row${x.n.id === d.treeSel ? ' on' : ''}" style="padding-left:${10 + x.depth * 26}px" data-act="tsel" data-v="${x.n.id}" aria-selected="${x.n.id === d.treeSel}">
      <span class="tag ${x.n.t === 'Machine' ? 't-in' : x.n.t === 'Site' ? 't-ok' : 't-gr'}" style="font-size:11px;padding:2px 6px;min-width:64px;text-align:center">${esc(x.n.t === 'Ligne de production' ? 'Ligne' : x.n.t)}</span>
      <span style="font-weight:${x.depth === 0 ? 600 : 500}">${esc(x.n.n)}</span><span class="muted" style="font-size:13px;margin-left:auto">${docsAt(x.n.id) ? docsAt(x.n.id) + ' doc.' : ''}</span></button>`).join('')}</div>`
      : `<p class="empty">L'arborescence est vide. Ajoutez un premier site ci-contre ou importez la nomenclature des équipements depuis un fichier Excel.</p>`}
    <div><button class="btn sec sm" data-act="addsite">${ic('plus', 16)}Ajouter un site</button></div></section>`;
  const editCard = `<aside class="card" style="flex:2 1 300px;gap:14px">${sel ? `<div><span class="muted" style="font-size:13px;font-weight:600">${esc(sel.n.t)}</span><h2 style="font-size:20px">${esc(sel.n.n)}</h2><p class="hint" style="margin:2px 0 0">${esc(sel.path.join(' › '))}</p></div>
      <div class="note" style="font-size:13px"><b>Documents attendus à ce niveau :</b> ${(LEVEL_EX[sel.n.t] || ['À définir']).join(', ')}.<br>${docsAt(sel.n.id)} document(s) rattaché(s) ici.</div>
      <div class="field"><label for="tren">Renommer</label><div style="display:flex;gap:8px"><input id="tren" class="in" value="${esc(sel.n.n)}"><button class="btn sec" data-act="trename">OK</button></div></div>
      ${types.length ? `<div class="field"><span class="lbl">Ajouter sous « ${esc(sel.n.n)} »</span><div style="display:flex;gap:8px;flex-wrap:wrap"><select id="tadt" class="in" style="flex:1 1 140px;width:auto" aria-label="Niveau">${opt(types, types[0])}</select><input id="tadn" class="in" style="flex:2 1 160px;width:auto" placeholder="Nom (ex. Pompe P-20)" aria-label="Nom"></div><button class="btn" data-act="tadd">${ic('plus', 18)}Ajouter</button></div>` : '<span class="hint">Dernier niveau : on ne peut pas ajouter d’élément en dessous.</span>'}
      ${S.treeMsg ? `<div class="alert t-wt" role="alert">${S.treeMsg}</div>` : ''}
      <button class="btn sec" style="color:var(--kox);border-color:var(--ko)" data-act="tdel">${ic('trash', 18)}Supprimer cet élément</button>`
    : '<p class="empty">Sélectionnez un élément de l’arborescence.</p>'}</aside>`;
  return shell('projets', `<div><h1>Projets et arborescences</h1><p class="sub">L'arborescence reproduit l'organisation réelle de l'usine. Elle sert ensuite de base au rattachement des documents, des interventions et des connaissances.</p></div>
    ${projList}${levelsCard}<div class="row">${treeCard}${editCard}</div>`);
};
