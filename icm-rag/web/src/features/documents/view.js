import { D } from '../../core/projectData.js';
import { QUAL, TYPES } from '../../core/referentials.js';
import { S, projName } from '../../core/state.js';
import { descIds, flat, nodeOpts, pathOf } from '../../core/tree.js';
import { esc, opt, slug } from '../../core/format.js';
import { ic } from '../../core/icons.js';
import { shell } from '../../core/navigation.js';
import { ACCEPT } from '../ingestion-screen/upload.js';

export const pages = {};

pages.documents = () => {
  const d = D(), s = S.docs, q = s.q.trim().toLowerCase(), ids = s.node === 'Tous' ? null : descIds(s.node);
  const rows = d.docs.filter((x) => (s.type === 'Tous' || x.type === s.type) && (!ids || ids.includes(x.node)) && (!q || x.n.toLowerCase().includes(q) || x.txt.toLowerCase().includes(q)));
  const sem = s.sem;
  const semPanel = !sem ? '' : `<section class="card" style="gap:10px" aria-label="Résultats de la recherche dans le contenu"><div class="head"><h2>Dans le contenu : « ${esc(sem.q)} »</h2><span class="hint">Passages indexés les plus proches, classés par pertinence</span></div>
    ${sem.loading ? '<p class="hint" role="status">Recherche en cours…</p>' : sem.err ? `<div class="alert t-ko" role="alert">${esc(sem.err)}</div>`
    : sem.hits.length ? sem.hits.map((h) => `<div style="display:flex;flex-direction:column;gap:4px;border-top:1px solid #e3e8ee;padding-top:10px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><a href="#document" data-act="opendoc" data-v="${esc(h.doc)}" style="font-weight:600;text-decoration:none">${esc(h.doc)} · v${h.ver}${h.page ? ' · page ' + h.page : h.section ? ' · § ' + esc(h.section) : ''}</a><span class="tag t-in">pertinence ${Math.round(h.score * 100)} %</span></div><span style="font-size:14px;border-left:3px solid var(--bd2);padding-left:10px;font-family:'IBM Plex Serif',Georgia,serif">« ${esc(h.extrait)}… »</span></div>`).join('')
    : '<p class="empty">Aucun passage pertinent dans ce périmètre.</p>'}</section>`;
  const inContent = (x) => q && !x.n.toLowerCase().includes(q) && x.txt.toLowerCase().includes(q);
  return shell('documents', `<div><h1>Recherche documentaire</h1><p class="sub">${rows.length} document${rows.length > 1 ? 's' : ''} · ${esc(projName())}. Filtrez par type de document (nature) et par niveau de l'arborescence (périmètre). Un niveau inclut tout ce qui se trouve en dessous.</p></div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">
      <div class="field" style="flex:2 1 300px"><label for="docq">Rechercher</label><input id="docq" class="in" type="search" placeholder="Dans le titre ou le contenu (ex. graissage, roulement)…" value="${esc(s.q)}" data-input="docq"></div>
      <div style="align-self:flex-end"><button class="btn sec" data-act="semsearch"${s.q.trim() ? '' : ' disabled'} title="Cherche par le sens dans le contenu indexé, pas seulement dans les titres">${ic('search', 18)}Chercher dans le contenu</button></div>
      <div class="field" style="flex:1 1 200px"><label for="dtype">Type de document</label><select id="dtype" class="in" data-input="dtype">${opt([['Tous', 'Tous les types'], ...TYPES], s.type)}</select></div>
      <div class="field" style="flex:1 1 260px"><label for="dnode">Niveau de rattachement</label><select id="dnode" class="in" data-input="dnode">${opt([['Tous', 'Toute l’arborescence'], ...nodeOpts()], s.node)}</select></div></div>
    ${semPanel}
    <div class="tbl"><table><thead><tr><th>Nom</th><th>Type</th><th>Rattaché à</th><th>Version</th><th>Qualification</th><th>Actions</th></tr></thead><tbody>
    ${rows.map((x) => `<tr><td><a href="#document" data-act="opendoc" data-v="${esc(x.n)}" style="font-weight:600;text-decoration:none">${esc(x.n)}</a>${inContent(x) ? '<div class="muted" style="font-size:12px">Mot trouvé dans le contenu</div>' : ''}</td>
      <td class="wrap" style="min-width:170px"><span class="tag t-in" style="white-space:normal">${esc(x.type)}</span></td><td class="wrap" style="font-size:14px;min-width:180px">${esc(pathOf(x.node))}</td><td>v${x.v}</td><td><span class="tag ${QUAL[x.q][1]}">${QUAL[x.q][0]}</span></td>
      <td><div style="display:flex;gap:8px"><a class="btn sec sm" href="#document" data-act="opendoc" data-v="${esc(x.n)}" aria-label="Afficher ${esc(x.n)}" title="Afficher">${ic('eye', 16)}</a><button class="btn sec sm" disabled aria-label="Téléchargement indisponible" title="Original non conservé sur le serveur">${ic('down', 16)}</button></div></td></tr>`).join('')}
    </tbody></table>${rows.length ? '' : `<p class="empty">${d.docs.length ? `Aucun document ne correspond${q ? ` à « ${esc(s.q)} »` : ''} avec ces filtres. Essayez un autre mot ou élargissez le niveau.` : 'Ce projet ne contient encore aucun document.'}</p>`}</div>`);
};

pages.document = () => {
  const d = D(), s = S.docv, admin = S.role === 'admin', x = d.docs.find((y) => y.n === S.docSel) || d.docs[0];
  if (!x) return shell('documents', `<div class="card" style="max-width:560px"><h1 style="font-size:24px">Aucun document</h1><p class="sub" style="margin:0">Ce projet ne contient encore aucun document.</p><a class="btn" href="#documents">Retour à la recherche</a></div>`);
  const vers = Array.from({ length: x.v }, (_, i) => x.v - i).map((k) => ['v' + k, k === x.v ? x.d : '', k === x.v ? (x.chg || 'Version en vigueur') : k === 1 ? 'Création du document' : 'Mise à jour']);
  const qi = ['brut', 'indexe', 'valide'].indexOf(x.q);
  const path = '/' + slug(projName()) + '/' + flat(D().tree).filter((y) => descIds(y.n.id).includes(x.node)).map((y) => slug(y.n.n)).join('/') + '/' + slug(x.n.replace(/(\.[^.]+)$/, '_v' + x.v + '$1'));
  const updPanel = admin && s.upd ? `<section class="card" style="border-color:var(--p)"><h2>Mettre à jour ce document</h2>
      <div class="note">Version actuelle : v${x.v}. Le nouveau fichier devient <b>v${x.v + 1}</b> ; la v${x.v} est conservée et reste consultable. Le type et le rattachement sont repris.</div>
      <div style="border:2px dashed #9ab4cf;background:#f5f8fb;border-radius:12px;padding:22px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center"><b style="font-weight:600">Nouveau fichier (facultatif)</b><label class="btn sec sm pick">Parcourir les fichiers<input class="sr" type="file" accept="${ACCEPT}" data-input="verfile"></label>
        <span class="hint">${s.fname ? 'Fichier choisi : <b>' + esc(s.fname) + '</b> — il sera relu et indexé comme v' + (x.v + 1) + '.' : 'Sans fichier, seule la version et sa description sont enregistrées.'}</span></div>
      <div class="field"><label for="updc">Ce qui change dans cette version</label><textarea id="updc" class="in" placeholder="Graissage passé de 500 h à 600 h…"></textarea></div>
      <div style="display:flex;gap:10px"><button class="btn" data-act="updpub">${ic('up', 18)}Publier la v${x.v + 1}</button><button class="btn sec" data-act="updtoggle">Annuler</button></div></section>` : '';
  return shell('documents', `<div style="display:flex;flex-direction:column;gap:12px"><nav class="crumb" aria-label="Fil d'Ariane"><a href="#documents">Recherche documentaire</a> / ${esc(x.n)}</nav>
    <div class="head"><div style="display:flex;align-items:center;flex-wrap:wrap;gap:12px"><h1>${esc(x.n)}</h1><span class="tag t-ok">v${x.v} en vigueur</span></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">${admin ? `<button class="btn sec" data-act="updtoggle">${ic('up', 18)}Nouvelle version</button><button class="btn sec" data-act="docedit">${ic('edit', 18)}Type et rattachement</button><button class="btn sec" style="color:var(--kox);border-color:var(--ko)" data-act="docdel">${ic('trash', 18)}Supprimer</button>` : ''}<button class="btn" data-act="dl" title="Le fichier d'origine n'est pas conservé sur le serveur">${ic('down', 18)}Télécharger l'original</button></div></div>
    ${s.done ? `<div class="alert t-ok" role="status">${s.done}</div>` : ''}</div>
    ${updPanel}${admin && s.edit ? `<section class="card" style="border-color:var(--p)"><h2>Type et rattachement</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
      <div class="field"><label for="dtp">Type de document</label><select id="dtp" class="in">${opt(TYPES, x.type)}</select></div>
      <div class="field"><label for="dnd">Niveau de rattachement</label><select id="dnd" class="in">${opt([['', 'Non rattaché'], ...nodeOpts()], x.node || '')}</select></div></div>
      <div style="display:flex;gap:10px"><button class="btn" data-act="docsave">Enregistrer</button><button class="btn sec" data-act="docedit">Annuler</button></div></section>` : ''}
    <div class="row"><div style="flex:3 1 460px;min-width:0;display:flex;flex-direction:column;gap:24px">
      <section aria-label="Aperçu du document" style="background:#e3e8ee;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#3d4752"><span>Extrait indexé</span><span class="hint">Le document complet est interrogeable via l'Assistant IA</span></div>
        <article style="background:#fff;border-radius:4px;padding:44px 52px;font-family:'IBM Plex Serif',Georgia,serif;font-size:15px;line-height:1.7;min-height:340px">
          <div style="font-family:'IBM Plex Sans',sans-serif;font-size:12px;color:var(--mut);display:flex;justify-content:space-between;border-bottom:1px solid #e3e8ee;padding-bottom:8px;margin-bottom:24px"><span>${esc(projName())} · ${esc(x.type)}</span><span>Révision ${x.v}</span></div>
          <h2 style="margin:0 0 16px;font-size:20px">${esc(x.ex[0])}</h2><p style="margin:0">${esc(x.ex[1])}</p></article></section></div>
    <aside style="flex:2 1 320px;min-width:0;display:flex;flex-direction:column;gap:24px">
      <section class="card"><h2>Informations</h2><dl style="margin:0;display:grid;grid-template-columns:1fr 1.7fr;gap:10px 16px;font-size:14px">
        <dt class="muted">Type</dt><dd style="margin:0"><span class="tag t-in" style="white-space:normal">${esc(x.type)}</span></dd>
        <dt class="muted">Rattaché à</dt><dd style="margin:0;font-weight:600">${esc(pathOf(x.node))}</dd>
        <dt class="muted">Format</dt><dd style="margin:0">${x.f}</dd>
        <dt class="muted">Chemin</dt><dd style="margin:0;font-family:ui-monospace,monospace;font-size:12px;word-break:break-all">${esc(path)}</dd>
        <dt class="muted">Mis à jour le</dt><dd style="margin:0">${x.d}</dd></dl>
        <div><span class="lbl">Qualification</span><div class="steps" style="margin-top:8px">${['Brut', 'Indexé', 'Connaissances validées'].map((l, i) => `<span class="tag ${i <= qi ? (i === 2 ? 't-ok' : 't-in') : 't-gr'}" style="${i <= qi ? '' : 'opacity:.7'}">${i + 1}. ${l}</span>${i < 2 ? '<span class="muted">›</span>' : ''}`).join('')}</div>
        <p class="hint" style="margin:8px 0 0">Brut : déposé · Indexé : lu par l'IA (OCR, embedding) · Connaissances validées : relations vérifiées par l'administrateur.</p></div></section>
      <section class="card" style="padding-top:8px;gap:0"><div role="tablist" class="tabs" style="margin-bottom:12px">
        <button role="tab" class="tab${s.tab === 'versions' ? ' on' : ''}" aria-selected="${s.tab === 'versions'}" data-act="dtab" data-v="versions">Versions</button>
        <button role="tab" class="tab${s.tab === 'activite' ? ' on' : ''}" aria-selected="${s.tab === 'activite'}" data-act="dtab" data-v="activite">Activité</button></div>
      ${s.tab === 'versions' ? vers.map((v, i) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--side)"><div><div style="font-weight:600">${v[0]}${v[1] ? ' · ' + v[1] : ''}</div><div class="muted" style="font-size:13px">${esc(v[2])}</div></div>${i === 0 ? '<span class="tag t-ok">En vigueur</span>' : `<span class="muted" style="font-size:13px">Archivée</span>`}</div>`).join('')
      : `<ol style="list-style:none;margin:0;padding:0 0 0 16px;border-left:2px solid #e3e8ee;display:flex;flex-direction:column;gap:18px">${D().hist.filter((h) => h[2] === x.n).concat([['', 'Intégration', x.n, 'Type « ' + x.type + ' » · rattaché à ' + pathOf(x.node), 'admin', 'Admin']]).map((h) => `<li style="position:relative"><span style="position:absolute;left:-23px;top:5px;width:12px;height:12px;border-radius:6px;background:var(--p)"></span><div style="font-weight:600">${esc(h[1])}</div><div class="muted" style="font-size:13px">${esc(h[3])}${h[0] ? ' · ' + h[0] : ''}</div></li>`).join('')}</ol>`}
      </section></aside></div>`);
};
