import { S } from '../../core/state.js';
import { esc, opt } from '../../core/format.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

pages.connecteurs = () => {
  const s = S.gmao, opts = ['Machine', 'Nom de la machine', 'Référence intervention', 'Type de document', 'Date', 'Document lié', 'Ne pas importer'];
  return shell('connecteurs', `<div class="head"><div><h1>Configuration et connecteurs</h1><p class="sub">Connecteur GMAO : importer les interventions et exporter les liens vers les documents liés aux équipements.</p></div><span class="tag ${s.ok ? 't-ok' : 't-gr'}" style="font-size:14px;padding:6px 12px">${s.ok ? 'Connecté' : 'Non connecté'}</span></div>
    <div class="row"><section class="card" style="flex:2 1 320px"><h2>Connexion GMAO</h2>
      <div class="field"><label for="gs">Logiciel GMAO</label><input id="gs" class="in" placeholder="Nom de votre GMAO" value="${esc(s.cfg.name)}" data-gcfg="name"></div>
      <div class="field"><label for="ga">Adresse de l'API</label><input id="ga" class="in" type="url" placeholder="https://gmao.entreprise.com/api" value="${esc(s.cfg.url)}" data-gcfg="url"></div>
      <div class="field"><label for="gk">Clé d'accès</label><input id="gk" class="in" type="password" autocomplete="off" placeholder="Non mémorisée dans ce navigateur"></div>
      <button class="btn sec" style="color:var(--p);border-color:var(--p)" data-act="gtest">Vérifier la saisie</button>
      ${s.msg ? `<div class="alert t-wt" role="status">${esc(s.msg)}</div>` : ''}
      <h2 style="margin-top:8px">Synchronisation</h2>
      <div class="field"><label for="gf">Fréquence</label><select id="gf" class="in" data-gcfg="freq">${opt(['Toutes les heures', 'Chaque nuit', 'Manuelle'], s.cfg.freq)}</select></div>
      <label class="choice"><input type="checkbox" data-input="gopt" data-id="0"${s.opts[0] ? ' checked' : ''}>Importer les comptes rendus d'intervention</label>
      <label class="choice"><input type="checkbox" data-input="gopt" data-id="1"${s.opts[1] ? ' checked' : ''}>Exporter les liens vers les documents</label></section>
    <section class="card" style="flex:3 1 460px"><div><h2>Correspondance des champs</h2><p class="hint" style="margin:4px 0 0">Associez chaque champ de la GMAO au champ ICM qui le reçoit. Le code équipement est relié à l'arborescence du projet.</p></div>
      <div class="tbl" style="border-radius:8px"><table><thead><tr><th>Champ GMAO</th><th></th><th>Champ ICM</th></tr></thead><tbody>
      ${s.map.map((m, i) => `<tr><td style="font-family:ui-monospace,monospace;font-size:14px">${m[0]}</td><td class="muted" aria-hidden="true">→</td><td><select class="in" style="min-height:40px;width:auto;min-width:220px" aria-label="Champ ICM pour ${m[0]}" data-input="map" data-id="${i}">${opt(opts, m[1])}</select></td></tr>`).join('')}</tbody></table></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center"><button class="btn" data-act="gsave">Enregistrer la configuration</button>${s.saved ? '<span style="font-size:14px;font-weight:600;color:var(--okx)">Configuration enregistrée</span>' : ''}</div></section></div>`);
};
