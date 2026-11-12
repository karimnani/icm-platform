import { ROLES } from '../../core/referentials.js';
import { esc } from '../../core/format.js';
import { S } from '../../core/state.js';
import { home, shell } from '../../core/navigation.js';
import { ic } from '../../core/icons.js';

export const pages = {};

pages.connexion = () => `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;background:var(--p)">
  <div style="width:100%;max-width:440px;display:flex;flex-direction:column;gap:20px;align-items:center">
    <div style="color:#fff;font-size:34px;font-weight:700;letter-spacing:.06em">ICM</div>
    <form data-act="login" class="card" style="width:100%;padding:32px;gap:18px" novalidate>
      <h1 style="font-size:24px">Connexion</h1>
      <div class="field"><label for="mail">Adresse e-mail</label><input id="mail" class="in" style="min-height:48px" type="email" placeholder="nom@entreprise.fr" autocomplete="username"></div>
      <div class="field"><label for="pw">Mot de passe</label><input id="pw" class="in" style="min-height:48px" type="password" placeholder="Votre mot de passe" autocomplete="current-password"></div>
      <div style="display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:8px;font-size:14px">
        <a href="#motdepasse" style="font-weight:600;text-decoration:none">Mot de passe oublié ?</a></div>
      ${S.loginErr ? `<p role="alert" style="margin:0;font-size:14px;font-weight:600;color:var(--kox)">${esc(S.loginErr)}</p>` : ''}
      <button class="btn" style="min-height:48px;font-size:16px" type="submit">Se connecter</button>
      <p class="muted" style="margin:0;text-align:center;font-size:13px">Seules les adresses créées par l'administrateur peuvent se connecter.</p>
      <p class="muted" style="margin:0;text-align:center;font-size:12px">Vos questions à l'assistant et vos évaluations sont enregistrées pour améliorer la base documentaire. Export et suppression : voir « Mon compte » et votre administrateur.</p>
    </form></div></div>`;
pages.motdepasse = () => `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--p)">
  <form data-act="recover" class="card" style="width:100%;max-width:440px" novalidate>
    <a href="#connexion" class="crumb" style="text-decoration:none;font-weight:600">← Retour à la connexion</a>
    <div><h1 style="font-size:24px">Mot de passe oublié</h1><p class="sub">Saisissez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.</p></div>
    ${S.recovered ? `<div class="alert t-ok" role="status">Si cette adresse correspond à un compte, un e-mail vient d'être envoyé. Le lien est valable 30 minutes.</div>` : `
    <div class="field"><label for="rmail">Adresse e-mail</label><input id="rmail" class="in" type="email" placeholder="nom@entreprise.fr"></div>
    <p id="rerr" role="alert" style="margin:0;font-size:14px;font-weight:600;color:var(--kox)"></p>
    <button class="btn" type="submit">Envoyer le lien</button>`}</form></div>`;
pages.refuse = () => shell('', `<div class="card" style="max-width:560px;align-items:flex-start"><span style="color:var(--kox)">${ic('lock', 32)}</span><h1 style="font-size:24px">Accès refusé</h1>
  <p class="sub" style="margin:0">Cet écran est réservé à l'administration. Votre rôle (${ROLES[S.role]}) ne permet pas d'y accéder.</p><a class="btn" href="#${home()}">Revenir à l'accueil</a></div>`);
