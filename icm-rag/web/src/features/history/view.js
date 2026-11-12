import { D } from '../../core/projectData.js';
import { S } from '../../core/state.js';
import { esc, opt } from '../../core/format.js';
import { ic } from '../../core/icons.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

/** Entrées du journal selon les filtres de l'onglet « Connexions et accès » (partagé avec l'export CSV). */
export const filteredLogs = (d, s) => d.logs.filter((l) => (s.luser === 'Tous' || l[2] === s.luser) && (s.per === 'all' || l[1] < Number(s.per)));

pages.historique = () => {
  const d = D(), s = S.hist;
  const cls = { 'Intégration': 't-in', 'Nouvelle version': 't-in', 'Rattachement': 't-gr', 'Arborescence': 't-gr', 'Validation': 't-ok', 'Correction': 't-in', 'Rejet': 't-ko', 'Intervention': 't-ok' };
  let body;
  if (s.tab === 'mv') {
    const q = s.q.trim().toLowerCase(), rows = d.hist.filter((r) => (s.type === 'Tous' || r[1] === s.type) && (s.user === 'Tous' || r[4] === s.user) && (!q || r[2].toLowerCase().includes(q)));
    body = `<div style="display:flex;flex-wrap:wrap;gap:12px"><input id="hq" class="in" style="flex:1 1 260px;width:auto" type="search" aria-label="Rechercher un document" placeholder="Rechercher un document ou un élément…" value="${esc(s.q)}" data-input="histq">
      <select class="in" style="flex:0 1 220px;width:auto" aria-label="Type de mouvement" data-input="histtype">${opt([['Tous', 'Tous les mouvements'], ...Object.keys(cls)], s.type)}</select>
      <select class="in" style="flex:0 1 200px;width:auto" aria-label="Utilisateur" data-input="histuser">${opt([['Tous', 'Tous les utilisateurs'], ...[...new Set(d.hist.map((r) => r[4]))]], s.user)}</select></div>
    <section class="tbl"><table><thead><tr><th>Date et heure</th><th>Mouvement</th><th>Élément</th><th>Détail</th><th>Par</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${r[0]}</td><td><span class="tag ${cls[r[1]] || 't-gr'}">${r[1]}</span></td><td class="wrap">${esc(r[2])}</td><td class="wrap">${esc(r[3])}</td><td><div style="font-weight:600">${esc(r[4])}</div><div class="muted" style="font-size:13px">${r[5]}</div></td></tr>`).join('')}</tbody></table>
      ${rows.length ? '' : '<p class="empty">Aucun mouvement ne correspond à ces filtres.</p>'}</section>`;
  } else {
    const rows = filteredLogs(d, s);
    body = `<div style="display:flex;flex-wrap:wrap;gap:12px">
      <div class="field" style="flex:0 1 240px"><label for="lp">Période</label><select id="lp" class="in" data-input="logper">${opt([['1', "Aujourd'hui"], ['7', '7 derniers jours'], ['30', '30 derniers jours'], ['all', 'Tout']], s.per)}</select></div>
      <div class="field" style="flex:0 1 240px"><label for="lu">Utilisateur</label><select id="lu" class="in" data-input="loguser">${opt([['Tous', 'Tous les utilisateurs'], ...[...new Set(d.logs.map((l) => l[2]))]], s.luser)}</select></div>
      <div style="align-self:flex-end"><button class="btn sec" data-act="exportlogs">${ic('down', 18)}Exporter (CSV)</button></div></div>
    <section class="tbl"><table><thead><tr><th>Date et heure</th><th>Utilisateur</th><th>Action</th><th>Détail</th><th>Statut</th></tr></thead><tbody>
      ${rows.map((l) => `<tr><td>${l[0]}</td><td style="font-weight:600">${l[2]}</td><td>${l[3]}</td><td class="wrap">${esc(l[4])}</td><td><span class="tag ${l[5] === 'Succès' ? 't-ok' : 't-ko'}">${l[5]}</span></td></tr>`).join('')}</tbody></table>
      ${rows.length ? '' : '<p class="empty">Aucune entrée sur cette période pour cet utilisateur.</p>'}</section>`;
  }
  return shell('historique', `<div><h1>Historique et traçabilité</h1><p class="sub">Qui a fait quoi, quand, sur quel document ou quelle connaissance. Les connexions et accès sont tracés dans le second onglet (cybersécurité).</p></div>
    <div class="tabs" role="tablist"><button role="tab" class="tab${s.tab === 'mv' ? ' on' : ''}" aria-selected="${s.tab === 'mv'}" data-act="htab" data-v="mv">Mouvements</button><button role="tab" class="tab${s.tab === 'log' ? ' on' : ''}" aria-selected="${s.tab === 'log'}" data-act="htab" data-v="log">Connexions et accès (logs)</button></div>${body}`);
};
