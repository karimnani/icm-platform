import { S } from '../../core/state.js';
import { esc } from '../../core/format.js';
import { ROLES } from '../../core/referentials.js';
import { shell } from '../../core/navigation.js';

export const pages = {};

pages.compte = () => `<div><h1>Mon compte</h1><p class="sub">${esc(S.userMail)}${S.userLogin ? ' · identifiant ' + esc(S.userLogin) : ''} · rôle ${ROLES[S.role]}</p></div>
  ${S.compte.msg ? `<div class="alert t-ok" role="status">${esc(S.compte.msg)}</div>` : ''}${S.compte.err ? `<div class="alert t-ko" role="alert">${esc(S.compte.err)}</div>` : ''}
  <div class="row"><form data-act="pwchange" class="card" style="flex:1 1 340px" novalidate><h2>Changer mon mot de passe</h2>
    <div class="field"><label for="pwo">Mot de passe actuel</label><input id="pwo" class="in" type="password" autocomplete="current-password"></div>
    <div class="field"><label for="pwn">Nouveau mot de passe</label><input id="pwn" class="in" type="password" autocomplete="new-password"><span class="hint">10 caractères minimum, avec au moins une lettre et un chiffre.</span></div>
    <div class="field"><label for="pwc">Confirmer le nouveau mot de passe</label><input id="pwc" class="in" type="password" autocomplete="new-password"></div>
    <div><button class="btn" type="submit"${S.busy ? ' disabled' : ''}>Enregistrer</button></div></form>
  <section class="card" style="flex:1 1 340px"><h2>Mes données personnelles</h2>
    <p class="hint" style="margin:0">Vos questions à l'assistant, vos évaluations et vos comptes rendus sont enregistrés pour améliorer la base documentaire. Vous pouvez en obtenir une copie à tout moment ; l'administrateur du projet peut les purger selon la durée de conservation fixée.</p>
    <div><button class="btn sec" data-act="exportme">Exporter mes données (JSON)</button></div></section></div>`;
