import { api, setToken, getToken } from './api.js';
import { PD, build } from './projectData.js';
import { EMPTY } from './seeds/index.js';
import { S } from './state.js';
import { switchProject } from './session.js';
import { home } from './navigation.js';
import { findNode } from './tree.js';
import { mapBootstrap, mapProjects, roleKey, mapConversations } from './mapping.js';

/** Branchement de l'interface sur l'API (D1) : session, chargement d'un projet, écritures suivies d'un rechargement. */
S.roles = {}; S.userMail = ''; S.userLogin = ''; S.err = ''; S.loginErr = '';
export const hasToken = () => !!getToken();

function applySession(r) {
  S.projects = mapProjects(r.projets);
  S.roles = Object.fromEntries(r.projets.map((p) => [p.id, roleKey(p.role)]));
  S.userMail = r.user.email; S.userLogin = r.user.login || '';
}

/** Charge le projet depuis D1 et remplace ses données en mémoire (les seeds ne servent plus). */
export async function hydrate(id) {
  const name = (S.projects.find((p) => p.id === id) || {}).n || id;
  const b = mapBootstrap(await api.bootstrap(id), name);
  const d = PD[id] && PD[id].remote ? PD[id] : (PD[id] = Object.assign(build(EMPTY()), { remote: true }));
  const { users, ...fields } = b;
  Object.assign(d, fields);
  const has = (list, sel) => list.some((x) => x.id === sel);
  if (!findInTree(d.tree, d.treeSel)) d.treeSel = d.tree[0] ? d.tree[0].id : null;
  if (!has(d.val, d.valSel)) d.valSel = d.val[0] ? d.val[0].id : null;
  S.acc.users = users;
  if (!d.convsLoaded) {   // historique des conversations enregistrées : chargé une fois par session et par projet (ne touche pas aux conversations en cours)
    try { const { convs, fb } = mapConversations((await api.discussions(id)).discussions || []); d.convs = convs; d.conv = convs[0] ? convs[0].id : null; Object.assign(d.fb, fb); d.convsLoaded = true; }
    catch (e) { /* historique indisponible : l'Assistant reste utilisable */ }
  }
  return d;
}
const findInTree = (list, id) => list.some((n) => n.id === id || findInTree(n.kids, id));

export async function openProject(id, render) {
  try { await hydrate(id); S.role = S.roles[id] || S.role; switchProject(id); S.err = ''; }
  catch (e) { S.err = e.message; }
  render();
}

export async function doLogin(email, password, render) {
  S.loginErr = '';
  try {
    if (!email.trim() || !password) throw new Error('Saisissez votre adresse e-mail et votre mot de passe.');
    const r = await api.login(email.trim(), password);
    setToken(r.token); applySession(r);
    if (!r.projets.length) throw new Error('Aucun projet n’est affecté à ce compte.');
    const first = r.projets.find((p) => p.role === 'Admin') || r.projets[0];
    S.project = first.id; await hydrate(first.id);
    S.role = S.roles[first.id]; switchProject(first.id); S.err = '';
    location.hash = home();
  } catch (e) { setToken(''); S.role = null; S.loginErr = e.message; }
  render();
}

export function logout() { setToken(''); S.role = null; S.userMail = ''; S.userLogin = ''; S.roles = {}; for (const k of Object.keys(PD)) delete PD[k]; }

/** Reprise de session au chargement de la page. */
export async function restoreSession() {
  try {
    applySession(await api.me());
    const first = S.projects.find((p) => S.roles[p.id] === 'admin') || S.projects[0];
    if (!first) throw new Error('aucun projet');
    S.project = first.id; await hydrate(first.id); S.role = S.roles[first.id]; switchProject(first.id);
    if (!location.hash || ['#connexion', '#motdepasse'].includes(location.hash)) location.hash = home();
  } catch (e) { setToken(''); S.role = null; if (e && e.status === 0) S.loginErr = e.message; }
}

/**
 * Écriture : appelle l'API, recharge le projet depuis D1, puis affiche.
 * `fn` peut renvoyer une valeur transmise à `after(result)` ; en cas d'échec le message va dans S[errKey] (bandeau d'erreur par défaut).
 */
export async function mutate(fn, render, { after, errKey = 'err' } = {}) {
  if (S.busy) return;   // une écriture à la fois : évite les doubles envois (double-clic = deux interventions)
  S.busy = true; render();
  try {
    const result = await fn();
    await hydrate(S.project);
    S.err = ''; if (errKey !== 'err') S[errKey] = '';
    if (after) after(result);
  } catch (e) {
    S[errKey] = e.message;
    if (e.status === 401) { logout(); location.hash = '#connexion'; S.loginErr = e.message; }
  } finally { S.busy = false; }
  render();
}
