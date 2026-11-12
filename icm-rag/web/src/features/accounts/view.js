import { S, projName } from '../../core/state.js';
import { esc, opt } from '../../core/format.js';
import { ic } from '../../core/icons.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

pages.comptes = () => {
  const s = S.acc, users = s.users.filter((u) => u.p === projName()), act = users.filter((u) => u.a).length;
  return shell('comptes', `<div class="head"><div><h1>Comptes et droits</h1><p class="sub">${users.length} comptes · ${act} actifs dans ${esc(projName())}. Seules les adresses e-mail ajoutées ici peuvent se connecter ; il n'y a pas d'inscription libre.</p></div><button class="btn" data-act="accform">${ic('plus', 18)}Créer un compte</button></div>
    ${s.msg ? `<div class="alert t-ok" role="status">${esc(s.msg)}</div>` : ''}
    ${s.form ? `<form data-act="acccreate" class="card" novalidate><h2>Nouveau compte</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
      <div class="field"><label for="am">Adresse e-mail</label><input id="am" class="in" type="email" placeholder="nom@entreprise.fr"></div>
      <div class="field"><label for="ar">Rôle</label><select id="ar" class="in">${opt(['Technicien', 'Admin'], 'Technicien')}</select></div>
      <div class="field"><label for="ap">Projet</label><select id="ap" class="in">${opt(S.projects.map((p) => p.n), projName())}</select></div></div>
      <p class="hint" style="margin:0">Un mot de passe temporaire est généré et affiché une seule fois ; il est stocké chiffré (PBKDF2).</p>
      ${s.err ? '<p role="alert" style="margin:0;font-size:14px;font-weight:600;color:var(--kox)">Saisissez une adresse e-mail valide.</p>' : ''}
      <div style="display:flex;gap:12px"><button class="btn" type="submit">Créer le compte</button><button class="btn sec" type="button" data-act="accform">Annuler</button></div></form>` : ''}
    <section class="tbl"><table><thead><tr><th>Adresse e-mail</th><th>Rôle</th><th>Projet</th><th>Dernière connexion</th><th>Statut</th><th>Action</th></tr></thead><tbody>
      ${users.map((u) => `<tr><td style="font-weight:600">${esc(u.m)}</td><td><select class="in" style="min-height:40px;width:auto" aria-label="Rôle de ${esc(u.m)}" data-input="role" data-id="${u.id}">${opt(['Technicien', 'Admin'], u.r)}</select></td><td>${esc(u.p)}</td><td>${u.l}</td><td><span class="tag ${u.a ? 't-ok' : 't-gr'}">${u.a ? 'Actif' : 'Désactivé'}</span></td><td><div style="display:flex;gap:8px"><button class="btn sec sm" data-act="toggleuser" data-v="${u.id}">${u.a ? 'Désactiver' : 'Réactiver'}</button>${u.a ? '' : `<button class="btn sec sm" style="color:var(--kox);border-color:var(--ko)" data-act="anonymise" data-v="${u.id}" title="Efface l'identité de ce compte désactivé (RGPD)">Anonymiser</button>`}</div></td></tr>`).join('')}</tbody></table>
      ${users.length ? '' : '<p class="empty">Aucun compte sur ce projet.</p>'}</section>
    <section class="card" style="gap:10px"><h2>Données personnelles (RGPD)</h2>
      <p class="hint" style="margin:0">Les questions posées à l'assistant sont enregistrées avec leur auteur. Vous pouvez supprimer les conversations anciennes (les évaluations « À analyser » sont conservées) et anonymiser les comptes désactivés. Chaque personne peut exporter ses données depuis « Mon compte ».</p>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap"><div class="field"><label for="retj">Supprimer les conversations de plus de (jours)</label><input id="retj" class="in" style="width:160px" type="number" min="30" value="365"></div><button class="btn sec" data-act="purgeconv">Purger</button></div>
      ${s.rgpd ? `<p role="alert" class="alert t-wt" style="margin:0">${esc(s.rgpd)}</p>` : ''}</section>`);
};
