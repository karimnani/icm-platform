import { S } from '../../core/state.js';
import { D } from '../../core/projectData.js';

/** Fait avancer les barres de progression des fichiers déposés (simulation) et rafraîchit l'écran concerné. */
export function startProgressTicker({ page, render, intervalMs = 500 }) {
  return setInterval(() => {
    if (!S.role) return;
    let changed = false;
    D().files.forEach((f) => { if (!f.real && f.p < 100) { f.p = Math.min(100, f.p + 3); changed = true; } });
    const ae = document.activeElement, typing = ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName);
    if (changed && page() === 'integration' && !typing) render();
  }, intervalMs);
}
