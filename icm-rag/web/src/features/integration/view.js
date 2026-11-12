import { D } from '../../core/projectData.js';
import { LEVEL_EX, TYPES } from '../../core/referentials.js';
import { S, projName } from '../../core/state.js';
import { descIds, findNode, flat, nodeOpts, pathOf } from '../../core/tree.js';
import { esc, opt, slug } from '../../core/format.js';
import { shell } from '../../core/navigation.js';
import { ACCEPT, canRetry } from './uploader.js';

export const pages = {};

pages.integration = () => {
  const d = D(), done = d.files.filter((f) => (f.real ? f.status === 'done' : f.p >= 100)).length;
  const stage = (f) => f.real ? { error: ['Échec', 't-ko'], done: ['Indexé', 't-ok'], sending: ['Lecture · indexation…', 't-in'], queued: ['En attente', 't-gr'] }[f.status]
    : f.p < 30 ? ['OCR en cours', 't-wt'] : f.p < 65 ? ['Embedding', 't-in'] : f.p < 100 ? ['Indexation', 't-in'] : ['Indexé', 't-ok'];
  const meta = d.fmeta[d.upSel] || ['', ''];
  const lvl = meta[1] && findNode(meta[1]) ? findNode(meta[1]).n.t : '';
  const path = (f) => { const m = d.fmeta[f.n] || ['', '']; const ids = m[1] ? flat(d.tree).filter((y) => descIds(y.n.id).includes(m[1])).map((y) => slug(y.n.n)) : ['non-rattache']; return '/' + slug(projName()) + '/' + ids.join('/') + '/' + slug(f.n.replace(/(\.[^.]+)$/, '_v1$1')); };
  return shell('integration', `<div><h1>Intégration documentaire</h1><p class="sub">Ajout de <b>nouveaux</b> documents. Pour une nouvelle version d'un document existant, passez par la Recherche documentaire (bouton « Nouvelle version » sur la fiche).</p></div>
    <div class="steps"><span class="tag t-in">1. Dépôt</span><span class="muted">›</span><span class="tag t-in">2. Type et rattachement</span><span class="muted">›</span><span class="tag t-in">3. OCR · embedding · indexation</span><span class="muted">›</span><span class="tag t-in">4. Connaissances proposées par l'IA</span><span class="muted">›</span><span class="tag t-ok">5. Validation par l'administrateur</span></div>
    <div class="row"><div style="flex:3 1 460px;min-width:0;display:flex;flex-direction:column;gap:24px">
      <section id="dropzone" style="border:2px dashed #9ab4cf;background:#f5f8fb;border-radius:12px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
        <div style="font-size:18px;font-weight:600">Glissez vos fichiers ici</div><div class="muted" style="font-size:14px">PDF, Word (.docx), Excel (.xlsx, .xls) · 50 Mo maximum</div>
        <label class="btn pick" style="margin-top:6px">Parcourir les fichiers<input class="sr" type="file" multiple accept="${ACCEPT}" data-input="upfiles"></label></section>
      <section class="card" style="gap:4px"><div class="head" style="margin-bottom:8px"><h2>Fichiers déposés</h2><span class="muted" style="font-size:14px">${done} sur ${d.files.length} indexé${done > 1 ? 's' : ''}</span></div>
      ${d.files.length ? '' : '<p class="empty">Aucun fichier déposé dans ce projet.</p>'}
      ${d.files.map((f) => { const [l, c] = stage(f), m = d.fmeta[f.n] || ['', '']; return `<div style="display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--side);flex-wrap:wrap"><div style="flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;gap:12px"><b style="font-weight:600">${esc(f.n)}</b><span class="muted" style="font-size:13px">${f.s}</span></div>
        <div class="bar${f.real && f.status === 'sending' ? ' indet' : ''}"><i style="width:${f.p}%;${f.p >= 100 ? 'background:var(--ok)' : ''}"></i></div>
        ${f.real && f.err ? `<div class="alert t-ko" role="alert">${esc(f.err)}</div>` : ''}
        ${f.real && f.status === 'error' ? `<div style="display:flex;gap:8px">${canRetry(f.n) ? `<button class="btn sec sm" data-act="upretry" data-v="${esc(f.n)}">Réessayer</button>` : ''}<button class="btn sec sm" data-act="upremove" data-v="${esc(f.n)}">Retirer</button></div>` : ''}
        <span class="hint">${m[0] ? esc(m[0]) : '<span style="color:var(--kox)">Type à choisir</span>'} · ${m[1] ? esc(pathOf(m[1])) : '<span style="color:var(--kox)">Rattachement à choisir</span>'}</span>
        <span class="muted" style="font-family:ui-monospace,monospace;font-size:12px;word-break:break-all">${esc(path(f))}</span></div>
        <span class="tag ${c}" style="min-width:110px;text-align:center">${l}</span></div>`; }).join('')}</section></div>
    <aside class="card" style="flex:2 1 320px"><h2>Informations du document</h2>
      ${d.files.length ? `<div class="field" style="background:#f0f5fa;border:1px solid #c9daea;border-radius:10px;padding:12px"><label for="fichier">Fichier</label>
        <select id="fichier" class="in" style="border-color:var(--p);font-weight:600" data-input="upfile">${opt(d.files.map((f) => f.n), d.upSel)}</select>
        <span class="hint">Les informations ci-dessous s'appliquent à ce fichier.</span></div>
      <div class="field"><label for="uptype">Type de document <span class="muted" style="font-weight:400">(nature)</span></label><select id="uptype" class="in" data-input="uptype">${opt([['', 'Choisir un type'], ...TYPES], meta[0])}</select></div>
      <div class="field"><label for="upnode">Niveau de rattachement <span class="muted" style="font-weight:400">(périmètre)</span></label><select id="upnode" class="in" data-input="upnode">${opt([['', 'Choisir dans l’arborescence'], ...nodeOpts()], meta[1])}</select>
        <span class="hint">${lvl ? `Documents attendus au niveau « ${esc(lvl)} » : ${(LEVEL_EX[lvl] || []).join(', ')}.` : 'Un plan général se rattache au site, une procédure ou une notice à la machine.'}</span></div>
      ${S.up.saved ? '<div class="alert t-ok" role="status">Informations enregistrées. Le document apparaîtra dans la recherche une fois indexé.</div>' : ''}
      <button class="btn" style="min-height:48px;font-size:16px" data-act="upsave"${meta[0] && meta[1] && (() => { const f = d.files.find((x) => x.n === d.upSel); return !(f && f.real && f.status !== 'done'); })() ? '' : ' disabled'}>Enregistrer</button>` : '<p class="hint">Déposez un fichier pour renseigner ses informations.</p>'}</aside></div>`);
};
