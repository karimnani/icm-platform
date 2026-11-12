import { D } from '../../core/projectData.js';
import { S } from '../../core/state.js';
import { esc, opt } from '../../core/format.js';
import { ic } from '../../core/icons.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

pages.validation = () => {
  const d = D(), lab = { attente: ['À valider', 't-wt'], validee: ['Validée', 't-ok'], rejetee: ['Rejetée', 't-ko'], corrigee: ['Corrigée et validée', 't-in'] };
  const sel = d.val.find((i) => i.id === d.valSel), pend = d.val.filter((i) => i.st === 'attente').length;
  if (!sel) return shell('validation', `<div><h1>Validation des connaissances</h1><p class="sub">Aucune connaissance proposée pour ce projet : l'IA en proposera après chaque intégration de document ou d'intervention.</p></div>`);
  const q = S.val.q.trim().toLowerCase(), shown = d.val.filter((i) => (S.val.f === 'all' || i.st === S.val.f) && (!q || [i.a, i.r, i.b, i.doc].join(' ').toLowerCase().includes(q)));
  const visible = shown.slice(0, S.val.n);
  const rel = (i) => `${esc(i.a)} <span class="muted">→ ${esc(i.r)} →</span> ${esc(i.b)}`;
  return shell('validation', `<div><div style="display:flex;align-items:center;flex-wrap:wrap;gap:14px"><h1>Validation des connaissances</h1><span class="tag t-wt" style="font-size:14px">${pend} à valider</span></div>
    <p class="sub">L'IA lit chaque document intégré et propose des connaissances (liens entre équipements, pièces, symptômes, causes et actions). Rien n'entre dans la base sans la décision de l'administrateur.</p></div>
    <div class="row"><section aria-label="Connaissances proposées" style="flex:2 1 300px;min-width:0;display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;gap:8px;flex-wrap:wrap"><select class="in" style="flex:1 1 140px;width:auto" aria-label="Filtrer par statut" data-input="valf">${opt([['all', 'Tous les statuts'], ['attente', 'À valider'], ['validee', 'Validées'], ['corrigee', 'Corrigées'], ['rejetee', 'Rejetées']], S.val.f)}</select>
      <input class="in" style="flex:2 1 160px;width:auto" type="search" id="valq" aria-label="Rechercher une connaissance" placeholder="Rechercher…" value="${esc(S.val.q)}" data-input="valq"></div>
    <span class="hint">${shown.length} sur ${d.val.length} connaissance${d.val.length > 1 ? 's' : ''}</span>
    ${visible.map((i) => { const on = i.id === d.valSel; return `<button data-act="pick" data-v="${i.id}" aria-pressed="${on}" style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:14px 16px;border-radius:10px;cursor:pointer;text-align:left;width:100%;${on ? 'background:#f0f5fa;border:2px solid var(--p)' : 'background:#fff;border:1px solid var(--bd)'}">
      <span style="display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%"><span style="font-size:15px;font-weight:600">${rel(i)}</span><span class="tag ${lab[i.st][1]}" style="font-size:12px">${lab[i.st][0]}</span></span><span class="muted" style="font-size:13px">${esc(i.doc)} · v${i.v}${i.hasPage ? ' · p. ' + i.page : ''}</span></button>`; }).join('')}
    ${shown.length > visible.length ? `<button class="btn sec" data-act="valmore">Afficher plus (${shown.length - visible.length})</button>` : ''}${shown.length ? '' : '<p class="empty">Aucune connaissance ne correspond à ces filtres.</p>'}</section>
    <section class="card" style="flex:3 1 460px;gap:18px" aria-label="Connaissance proposée">
      <div class="head"><h2>Connaissance proposée</h2><span class="tag ${lab[sel.st][1]}">${lab[sel.st][0]}</span></div>
      <div style="display:flex;flex-direction:column;gap:14px;border-top:1px solid #e3e8ee;padding-top:16px">
        <div style="display:flex;gap:12px"><span style="color:var(--p)">${ic('file', 20)}</span><div><h3>Origine</h3><a href="#document" data-act="opendoc" data-v="${esc(sel.doc)}" style="text-decoration:none;font-size:14px">${esc(sel.doc)} — Version ${sel.v}${sel.hasPage ? ', page ' + sel.page : ''}</a></div></div>
        <div style="display:flex;gap:12px"><span style="color:var(--p)">${ic('bulb', 20)}</span><div><h3>Interprétation de l'IA</h3><p style="margin:2px 0 0;font-size:14px;line-height:1.55">${esc(sel.interp)}</p></div></div>
        <div style="display:flex;gap:12px"><span style="color:var(--p)">${ic('layers', 20)}</span><div><h3>Connaissance à intégrer</h3><p style="margin:2px 0 0;font-size:14px;line-height:1.55">${esc(sel.know)}</p></div></div></div>
      ${S.val.editing ? `<div class="field" style="border-top:1px solid #e3e8ee;padding-top:16px"><span class="lbl">Corriger la connaissance</span><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
        <input id="ea" class="in" aria-label="Élément de départ" value="${esc(sel.a)}"><input id="er" class="in" aria-label="Type de lien" value="${esc(sel.r)}"><input id="eb" class="in" aria-label="Élément d'arrivée" value="${esc(sel.b)}"></div>
        <textarea id="ek" class="in" aria-label="Connaissance à intégrer">${esc(sel.know)}</textarea>
        <div style="display:flex;gap:10px"><button class="btn" data-act="saveedit">Enregistrer la correction</button><button class="btn sec" data-act="canceledit">Annuler</button></div></div>` : ''}
      ${sel.st === 'attente' && S.val.rejecting ? `<div class="field" style="border-top:1px solid #e3e8ee;padding-top:16px"><label for="rm">Motif du rejet <span class="muted" style="font-weight:400">(obligatoire, conservé dans l'historique)</span></label>
        <textarea id="rm" class="in" placeholder="Ex. : doublon, information erronée, source obsolète…"></textarea>${S.val.err ? `<p role="alert" class="alert t-ko" style="margin:6px 0 0">${esc(S.val.err)}</p>` : ''}
        <div style="display:flex;gap:10px"><button class="btn ko" data-act="rejconfirm">${ic('x', 18)}Confirmer le rejet</button><button class="btn sec" data-act="rejcancel">Annuler</button></div></div>` : ''}
      ${sel.st === 'attente' && !S.val.editing && !S.val.rejecting ? `<div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn ok" style="flex:1 1 130px;min-height:48px" data-act="decide" data-v="validee">${ic('check', 18)}Valider</button><button class="btn sec" style="flex:1 1 130px;min-height:48px" data-act="edit">${ic('edit', 18)}Corriger</button><button class="btn ko" style="flex:1 1 130px;min-height:48px" data-act="decide" data-v="rejetee">${ic('x', 18)}Rejeter</button></div>`
        : sel.st !== 'attente' ? `<div class="alert ${lab[sel.st][1]}">${sel.st === 'rejetee' ? 'Connaissance rejetée : elle n’entre pas dans la base.' : 'Connaissance intégrée à la base : l’assistant peut maintenant l’utiliser.'}</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #e3e8ee;padding-top:14px"><span class="muted" style="font-size:14px;font-weight:600">Historique du statut</span>${sel.h.map((x) => `<div style="font-size:14px">${esc(x)}</div>`).join('')}</div>
    </section></div>`);
};
