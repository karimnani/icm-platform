import { D } from '../../core/projectData.js';
import { S } from '../../core/state.js';
import { esc, opt } from '../../core/format.js';
import { findNode, nodeOpts, pathOf } from '../../core/tree.js';
import { ic } from '../../core/icons.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

export function analyse(f) {
  const out = [], ok = (b, t) => out.push([b ? 'ok' : 'ko', t]), warn = (t) => out.push(['wt', t]);
  ok(!!f.m, f.m ? 'Équipement renseigné : ' + pathOf(f.m) : 'Équipement non renseigné');
  ok(f.pb.length >= 10, f.pb.length >= 10 ? 'Problème constaté décrit' : 'Problème constaté trop peu détaillé');
  ok(f.diag.length >= 5, f.diag.length >= 5 ? 'Diagnostic renseigné' : 'Diagnostic / cause manquant');
  ok(f.trav.length >= 10, f.trav.length >= 10 ? 'Travaux réalisés décrits' : 'Travaux réalisés trop peu détaillés');
  const h = parseFloat(String(f.h).replace(',', '.'));
  ok(h > 0 && h <= 24, h > 0 && h <= 24 ? 'Durée cohérente (' + h + ' h)' : 'Durée manquante ou incohérente');
  ok(!!f.etat, f.etat ? 'État final : ' + f.etat : 'État final non renseigné');
  const t = (f.pb + ' ' + f.diag).toLowerCase();
  const pairs = [[/bruit|vibr|claqu/, /roulement|palier|courroie|graiss|desserr/], [/échauff|chauff|temp/, /graiss|lubrif|palier|roulement|ventil|filtre/], [/fuite/, /joint|raccord|flexible|serr/], [/bourr|blocage|bloqu/, /lame|usure|réglage|corps/]];
  if (f.pb && f.diag) { const pr = pairs.find((p) => p[0].test(t)); if (pr) { if (pr[1].test(t)) out.push(['ok', 'Cohérence : le diagnostic explique le problème constaté.']); else warn('Cohérence à vérifier : le diagnostic ne semble pas expliquer le problème constaté. Précisez la cause.'); } }
  if (f.etat === 'Remis en service' && /provisoire|à reprendre|en attente/.test(f.trav.toLowerCase())) warn('Les travaux semblent provisoires alors que l’état final indique « Remis en service ».');
  const sim = D().crs.find((c) => c.m === f.m);
  if (sim) out.push(['info', `Intervention similaire trouvée : ${sim.id} du ${sim.d} (${sim.diag.toLowerCase()}). Panne potentiellement récurrente.`]);
  return out;
}
pages.interventions = () => {
  const d = D(), s = S.cr, f = s.f, admin = S.role === 'admin';
  const blocking = s.ai && s.ai.some((x) => x[0] === 'ko');
  const ico = { ok: ['check', 'var(--okx)'], ko: ['x', 'var(--kox)'], wt: ['info', 'var(--wtx)'], info: ['bulb', 'var(--p)'] };
  const form = `<form data-act="crsubmit" class="card" novalidate>
    <div class="head"><div><h2>Compte rendu d'intervention</h2><p class="hint" style="margin:4px 0 0">Saisie rapide sur le terrain. L'IA analyse la pertinence et la cohérence, puis le compte rendu est rattaché à l'équipement et intégré à la base (type « Rapports d'intervention / Relevés de mesures »).</p></div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
      <div class="field"><label for="crm">Équipement concerné</label><select id="crm" class="in" data-cr="m">${opt([['', 'Choisir un équipement'], ...nodeOpts('Machine')], f.m)}</select></div>
      <div class="field"><label for="crd">Date</label><input id="crd" class="in" type="date" value="${esc(f.d)}" data-cr="d"></div>
      <div class="field"><label for="crh">Durée d'intervention (h)</label><input id="crh" class="in" inputmode="decimal" placeholder="1,5" value="${esc(f.h)}" data-cr="h"></div>
      <div class="field"><label for="cre">État final</label><select id="cre" class="in" data-cr="etat">${opt([['', 'Choisir'], 'Remis en service', 'En service dégradé', 'À l’arrêt'], f.etat)}</select></div></div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="field"><label for="crp">Problème constaté (panne)</label><textarea id="crp" class="in" placeholder="Échauffement anormal du palier" data-cr="pb">${esc(f.pb)}</textarea></div>
      <div class="field"><label for="crg">Diagnostic / cause identifiée</label><textarea id="crg" class="in" placeholder="Décrire le diagnostic effectué…" data-cr="diag">${esc(f.diag)}</textarea></div>
      <div class="field"><label for="crt">Travaux réalisés</label><textarea id="crt" class="in" placeholder="Décrire les actions réalisées…" data-cr="trav">${esc(f.trav)}</textarea></div>
      <div class="field"><label for="crpi">Pièces remplacées (facultatif)</label><input id="crpi" class="in" placeholder="Roulement 6205-2RS (x1)" value="${esc(f.pieces)}" data-cr="pieces"></div></div>
    ${s.ai ? `<section class="card" style="background:var(--bg);padding:16px;gap:8px" role="status"><h3>Analyse de l'IA</h3>
      ${s.ai.map((x) => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:14px;color:${ico[x[0]][1]}">${ic(ico[x[0]][0], 18)}<span>${esc(x[1])}</span></div>`).join('')}
      ${blocking ? '<span class="hint">Complétez les points en rouge puis soumettez à nouveau.</span>' : '<span class="hint">Vous pouvez corriger le compte rendu ou l’enregistrer tel quel.</span>'}</section>` : ''}
    ${s.saved ? `<div class="alert t-ok" role="status">${s.saved}</div>` : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn${s.ai && !blocking ? ' sec' : ''}" type="submit">${ic('bulb', 18)}Soumettre à l'IA</button>
      ${s.ai && !blocking ? `<button class="btn" type="button" data-act="crsave">${ic('check', 18)}Enregistrer dans la base</button>` : ''}</div></form>`;
  const mine = d.crs.filter((c) => admin || c.by === (S.userLogin || 'p.durand'));
  const list = `<section class="tbl"><table><thead><tr><th>Référence</th><th>Équipement</th><th>Date</th><th>Problème</th><th>Diagnostic</th><th>Durée</th><th>État final</th>${admin ? '<th>Par</th>' : ''}<th>Statut</th></tr></thead><tbody>
    ${mine.map((c) => `<tr><td style="font-weight:600">${c.id}</td><td>${esc(findNode(c.m) ? findNode(c.m).n.n : '—')}</td><td>${c.d}</td><td class="wrap">${esc(c.pb)}</td><td class="wrap">${esc(c.diag)}</td><td>${String(c.h).replace('.', ',')} h</td><td>${esc(c.etat)}</td>${admin ? `<td>${c.by}</td>` : ''}<td><span class="tag t-ok">${c.st}</span></td></tr>`).join('')}</tbody></table>
    ${mine.length ? '' : '<p class="empty">Aucune intervention enregistrée.</p>'}</section>`;
  return shell('interventions', `<div><h1>Interventions</h1><p class="sub">Le technicien renseigne son compte rendu après chaque intervention : il enrichit la base de connaissances et les réponses de l'assistant.</p></div>
    <div class="tabs" role="tablist"><button role="tab" class="tab${s.tab === 'new' ? ' on' : ''}" aria-selected="${s.tab === 'new'}" data-act="crtab" data-v="new">Nouveau compte rendu</button>
      <button role="tab" class="tab${s.tab === 'list' ? ' on' : ''}" aria-selected="${s.tab === 'list'}" data-act="crtab" data-v="list">${admin ? 'Toutes les interventions' : 'Mes interventions'}</button></div>
    ${s.tab === 'new' ? form : list}`);
};
