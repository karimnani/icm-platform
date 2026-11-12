import { S, projName } from '../../core/state.js';
import { esc, opt } from '../../core/format.js';
import { fmtDateTime } from '../../core/mapping.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

const PER = [['7', '7 derniers jours'], ['30', '30 derniers jours'], ['90', '90 derniers jours'], ['all', 'Depuis le début']];
const NIV = { partielle: ['Partiellement', 't-wt'], incorrecte: ['Incorrecte', 't-ko'] };
const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);
const bar = (n, t, ko) => `<div class="bar" role="img" aria-label="${n} sur ${t}"><i style="width:${pct(n, t)}%${ko ? ';background:var(--ko)' : ''}"></i></div>`;
const kpi = (label, value, hint) => `<div class="kpi"><span class="muted" style="font-size:13px;font-weight:600">${label}</span><b>${value}</b>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const fh = (h) => (h == null ? '—' : String(h).replace('.', ',') + ' h');

/** Signalements filtrés : « À analyser » par défaut. */
export const visibleSignals = (x, filter) => (x.signalements || []).filter((s) => filter === 'all' || s.statut_suivi === 'À analyser');

pages.indicateurs = () => {
  const s = S.ind, x = s.data;
  const head = `<div class="head"><div><h1>Indicateurs de pilotage</h1><p class="sub">Usage de l'assistant, qualité des réponses et qualification de la base pour <b>${esc(projName())}</b>. Les réponses jugées insatisfaisantes arrivent ici : analysez-les, corrigez la source ou la connaissance, puis marquez-les traitées.</p></div>
    <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap"><div class="field"><label for="iper">Période</label><select id="iper" class="in" style="width:auto" data-input="iper">${opt(PER, s.per)}</select></div><button class="btn sec" data-act="indrefresh">Actualiser</button></div></div>`;
  if (!x) return shell('indicateurs', head + (s.err ? `<div class="alert t-ko" role="alert">${esc(s.err)}</div>` : '<p class="hint" role="status">Chargement des indicateurs…</p>'));
  const E = x.evaluations, Q = x.qualification, K = x.connaissances, sig = visibleSignals(x, s.filter);
  const maxM = Math.max(1, ...x.motifs.map((m) => m.n)), maxS = Math.max(1, ...x.sources_citees.map((m) => m.n));
  const row = (sg) => {
    const open = s.treat === sg.id, done = sg.statut_suivi !== 'À analyser', n = NIV[sg.niveau_utile] || [sg.niveau_utile, 't-gr'];
    return `<tr><td>${fmtDateTime(sg.created_at)}</td><td class="wrap" style="min-width:220px">${esc(sg.question || '—')}</td><td><span class="tag ${n[1]}">${n[0]}</span></td>
      <td class="wrap">${esc(sg.motif || '—')}${sg.commentaire ? `<div class="muted" style="font-size:13px">${esc(sg.commentaire)}</div>` : ''}</td><td class="wrap" style="font-size:14px">${esc(sg.sources || 'Aucune source')}</td>
      <td><span class="tag ${done ? (sg.statut_suivi === 'Corrigé' ? 't-ok' : 't-gr') : 't-wt'}">${esc(sg.statut_suivi)}</span>${done ? `<div class="muted" style="font-size:12px">${esc(sg.traite_par || '')}${sg.suivi_commentaire ? ' · ' + esc(sg.suivi_commentaire) : ''}</div>` : ''}</td>
      <td><button class="btn sec sm" data-act="indtreat" data-v="${esc(sg.id)}" aria-expanded="${open}">${done ? 'Modifier' : 'Traiter'}</button></td></tr>
      ${open ? `<tr><td colspan="7" style="background:var(--bg)"><div class="field"><label for="indc">Qu'avez-vous corrigé ? <span class="muted" style="font-weight:400">(source mise à jour, connaissance validée, document retiré…)</span></label>
        <textarea id="indc" class="in" placeholder="Ex. : procédure P-12 republiée en v4 avec le couple de serrage">${esc(sg.suivi_commentaire || '')}</textarea></div>
        ${s.treatErr ? `<p role="alert" class="alert t-ko" style="margin:8px 0">${esc(s.treatErr)}</p>` : ''}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px"><button class="btn ok" data-act="indset" data-v="Corrigé">Marquer corrigé</button><button class="btn sec" data-act="indset" data-v="Sans suite">Classer sans suite</button>${done ? '<button class="btn sec" data-act="indset" data-v="À analyser">Rouvrir</button>' : ''}</div></td></tr>` : ''}`;
  };
  return shell('indicateurs', `${head}
    <section aria-label="Indicateurs clés" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
      ${kpi('Questions posées', x.questions, `${x.reponses} réponses · ${x.sans_reponse} « Je ne sais pas »`)}
      ${kpi('Taux de satisfaction', x.taux_satisfaction == null ? '—' : x.taux_satisfaction.toString().replace('.', ',') + ' %', E.total ? `${E.satisfaisante} sur ${E.total} évaluations` : 'Aucune évaluation sur la période')}
      ${kpi('Réponses évaluées', x.taux_evaluation == null ? '—' : x.taux_evaluation.toString().replace('.', ',') + ' %', 'Part des réponses notées par les techniciens')}
      ${kpi('Base validée', Q.taux_valide == null ? '—' : Q.taux_valide.toString().replace('.', ',') + ' %', `${Q.valide} document(s) sur ${Q.total}`)}
      ${kpi('Connaissances capitalisées', K.validee + K.corrigee, `${K.attente} à valider · ${K.rejetee} rejetée(s)`)}
      ${kpi('Durée moyenne d’intervention', fh(x.interventions.duree_moyenne), `${x.interventions.n} intervention(s) · repère du MTTR`)}</section>
    <div class="row">
      <section class="card" style="flex:1 1 320px;gap:12px"><h2>Qualification de la base</h2>
        ${[['Brut', Q.brut, 't-gr'], ['Indexé', Q.indexe, 't-in'], ['Connaissances validées', Q.valide, 't-ok']].map((r) => `<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:14px"><span><span class="tag ${r[2]}">${r[0]}</span></span><b>${r[1]}</b></div>${bar(r[1], Q.total)}</div>`).join('')}
        ${Q.total ? '' : '<p class="empty">Aucun document dans ce projet.</p>'}</section>
      <section class="card" style="flex:1 1 320px;gap:12px"><h2>Motifs d'insatisfaction</h2>
        ${x.motifs.length ? x.motifs.map((m) => `<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${esc(m.motif)}</span><b>${m.n}</b></div>${bar(m.n, maxM, true)}</div>`).join('') : '<p class="empty">Aucune réponse jugée insatisfaisante sur la période.</p>'}</section>
      <section class="card" style="flex:1 1 320px;gap:12px"><h2>Sources les plus citées</h2>
        ${x.sources_citees.length ? x.sources_citees.map((m) => `<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:14px;gap:8px"><span>${esc(m.doc)}</span><b>${m.n}</b></div>${bar(m.n, maxS)}</div>`).join('') : '<p class="empty">Aucune source citée sur la période.</p>'}</section></div>
    <section aria-label="Réponses signalées" style="display:flex;flex-direction:column;gap:12px">
      <div class="head"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h2>Réponses signalées</h2><span class="tag ${x.signalements_a_analyser ? 't-wt' : 't-ok'}">${x.signalements_a_analyser} à analyser</span></div>
        <select class="in" style="width:auto" aria-label="Filtrer les signalements" data-input="indfilter">${opt([['a', 'À analyser'], ['all', 'Tous les signalements']], s.filter)}</select></div>
      <div class="tbl"><table><thead><tr><th>Date</th><th>Question</th><th>Évaluation</th><th>Motif et commentaire</th><th>Source citée</th><th>Suivi</th><th>Action</th></tr></thead><tbody>${sig.map(row).join('')}</tbody></table>
        ${sig.length ? '' : `<p class="empty">${s.filter === 'a' ? 'Aucune réponse à analyser : la boucle qualité est à jour.' : 'Aucune réponse signalée.'}</p>`}</div></section>`);
};
