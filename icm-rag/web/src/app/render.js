import { S } from '../core/state.js';
import { ACCESS, home } from '../core/navigation.js';
import { esc } from '../core/format.js';
import { pages, mounts } from './registry.js';

export const root = document.getElementById('root');
const PUBLIC = ['connexion', 'motdepasse'];

/** Écran à afficher d'après l'adresse (#...), le rôle connecté et les droits d'accès. */
export function page() {
  const h = location.hash.slice(1) || 'connexion';
  if (PUBLIC.includes(h)) return h;
  if (!S.role) return 'connexion';
  if (!pages[h]) return home();
  if (ACCESS[h] && !ACCESS[h].includes(S.role)) return 'refuse';
  return h;
}

/** Repli d'affichage : l'erreur est visible et récupérable (retour à l'accueil / rechargement) au lieu d'un écran figé. */
function renderFailure(e) {
  console.error('erreur d’affichage :', e);
  root.innerHTML = `<div class="alert t-ko" role="alert" style="margin:24px">Une erreur d’affichage est survenue (${esc(e && e.message ? e.message : e)}).
    Vos données enregistrées sont intactes. <a href="./">Recharger l’application</a></div>`;
}

export function render(keepFocus) {
  try {
    const f = document.activeElement, fid = keepFocus && f && f.id, pos = fid && f.selectionStart;
    root.innerHTML = pages[page()]();
    const mount = mounts[page()]; if (mount) mount(render);
    if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* champ sans sélection */ } } }
  } catch (e) { renderFailure(e); }
}
