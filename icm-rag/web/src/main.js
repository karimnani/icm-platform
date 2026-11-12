import { installRouter } from './app/router.js';
import { page, render } from './app/render.js';
import { startProgressTicker } from './features/integration/ticker.js';
import { hasToken, restoreSession } from './core/remote.js';

/** Filet global : une erreur non interceptée est signalée par une bannière hors de l'écran applicatif (la saisie en cours n'est pas effacée). */
function notify(e) {
  const msg = e && e.message ? e.message : String(e);
  console.error('erreur non interceptée :', e);
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.setAttribute('role', 'alert');
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;padding:12px 16px;border-radius:8px;background:#7a1f1f;color:#fff;font:14px/1.4 system-ui,sans-serif';
  el.textContent = 'Une erreur inattendue est survenue : ' + msg + '. Si le problème persiste, rechargez la page.';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 9000);
}
window.addEventListener('error', (ev) => notify(ev.error || ev.message));
window.addEventListener('unhandledrejection', (ev) => notify(ev.reason));

installRouter();
startProgressTicker({ page, render });
try { if (hasToken()) await restoreSession(); }   // session mémorisée : on recharge le projet depuis D1 avant le premier rendu
catch (e) { console.error('reprise de session :', e); }   // quoi qu'il arrive, l'écran s'affiche (connexion)
render();
