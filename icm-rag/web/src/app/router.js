import { S } from '../core/state.js';
import { D } from '../core/projectData.js';
import { root, render } from './render.js';
import { actions, submits, inputs, changes, changeActs, fields, hashHooks } from './registry.js';

/** Champ repéré par un attribut data-* (ex. data-cr) : renvoie son gestionnaire, ou undefined. */
const fieldHandler = (t) => { const k = Object.keys(fields).find((x) => t.dataset[x]); return k && fields[k]; };

/** Exécute un gestionnaire : toute exception (immédiate ou d'une promesse non attendue) est affichée dans le bandeau d'erreur. */
const failed = (e) => { console.error('erreur de gestionnaire :', e); S.err = 'Erreur inattendue : ' + (e && e.message ? e.message : e); S.busy = false; render(); };
const guard = (fn) => {
  try { const r = fn(); if (r && typeof r.then === 'function') r.then(undefined, failed); return r; }
  catch (e) { failed(e); return false; }
};

/** Branche les événements de l'interface sur les gestionnaires des fonctionnalités. */
export function installRouter() {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'FORM' || b.tagName === 'INPUT') return;
    if (b.disabled) return;
    const fn = actions[b.dataset.act]; if (!fn) return;
    if (guard(() => fn({ e, b, v: b.dataset.v, d: S.role ? D() : null, render })) === false) return;
    render();
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const fn = submits[e.target.dataset.act];
    if (fn && guard(() => fn({ e, render })) === false) return;
    render();
  });

  root.addEventListener('input', (e) => {
    const t = e.target, f = fieldHandler(t);
    if (f) { guard(() => f({ t })); return; }
    const fn = inputs[t.dataset.input]; if (!fn) return;
    if (guard(() => { fn({ t }); }) === false) return;
    render(true);
  });

  root.addEventListener('change', (e) => {
    const t = e.target, ca = changeActs[t.dataset.act];
    if (ca) { if (guard(() => { ca({ t }); }) !== false) render(); return; }
    const f = fieldHandler(t);
    if (f) { guard(() => f({ t })); return; }
    const fn = changes[t.dataset.input]; if (!fn) return;
    if (guard(() => fn({ t, v: t.value, i: Number(t.dataset.id), d: D(), render })) === false) return;
    render();
  });

  window.addEventListener('hashchange', () => { S.err = ''; hashHooks.forEach((h) => h(location.hash)); render(); window.scrollTo(0, 0); });
}
