import { workerUrl } from './config.js';

/** Client de l'API /api/* du Worker (D1). Le jeton de session est mémorisé dans le navigateur. */
const KEY = 'icm.token';
export class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }
export const getToken = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
export const setToken = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) { /* stockage indisponible */ } };

const TRANSIENT_STATUS = [502, 503, 504];
export function createApi({ getBaseUrl = workerUrl, fetchFn = (...a) => fetch(...a), timeoutMs = 20000, retryDelayMs = 400 } = {}) {
  /** Une lecture est retentée UNE fois (réseau instable, 502/503/504) ; une écriture ne l'est jamais (risque de doublon). */
  async function call(method, path, body, opts = {}) {
    const retryable = method === 'GET';
    try { return await once(method, path, body, opts); }
    catch (e) {
      if (!retryable || !(e instanceof ApiError) || !(e.status === 0 && !e.offline && !e.late || TRANSIENT_STATUS.includes(e.status))) throw e;
      await new Promise((r) => setTimeout(r, retryDelayMs));
      return once(method, path, body, opts);
    }
  }
  async function once(method, path, body, { auth = true, timeout } = {}) {
    const base = String(getBaseUrl() || '').trim().replace(/\/+$/, '');
    if (!base) throw new ApiError('L’adresse du Worker n’est pas renseignée.', 0);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const off = new ApiError('Vous êtes hors ligne : cette action nécessite une connexion. Rien n’a été envoyé.', 0); off.offline = true; throw off;
    }
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout || timeoutMs);
    try {
      const res = await fetchFn(base + path, {
        method, signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(auth && getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = null; try { data = await res.json(); } catch (e) { /* corps non JSON */ }
      if (!res.ok || (data && data.ok === false)) {
        if (res.status === 401 && auth) setToken('');
        throw new ApiError((data && data.error) || `Le serveur a répondu ${res.status}.`, res.status);
      }
      return data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const late = !!(e && e.name === 'AbortError');   // délai dépassé : jamais retenté (un serveur lent n'ira pas plus vite)
      const err = new ApiError(late ? 'Le serveur n’a pas répondu dans le délai imparti.' : `Serveur injoignable (${base}). Vérifiez la connexion et l’adresse du Worker.`, 0); err.late = late; throw err;
    } finally { clearTimeout(timer); }
  }
  const P = (pid) => `/api/projets/${encodeURIComponent(pid)}`;
  return {
    login: (email, password) => call('POST', '/api/login', { email, password }, { auth: false }),
    me: () => call('GET', '/api/me'),
    bootstrap: (pid) => call('GET', P(pid) + '/bootstrap'),
    createProject: (nom) => call('POST', '/api/projets', { nom }),
    addNode: (pid, node) => call('POST', P(pid) + '/noeuds', node),
    importTree: (pid, tree) => call('POST', P(pid) + '/arborescence', { tree }),
    renameNode: (pid, id, nom) => call('PATCH', `${P(pid)}/noeuds/${encodeURIComponent(id)}`, { nom }),
    deleteNode: (pid, id) => call('DELETE', `${P(pid)}/noeuds/${encodeURIComponent(id)}`),
    createIntervention: (pid, r) => call('POST', P(pid) + '/interventions', r),
    decide: (pid, cid, d) => call('POST', `${P(pid)}/connaissances/${encodeURIComponent(cid)}/decision`, d),
    addVersion: (pid, did, note) => call('POST', `${P(pid)}/documents/${encodeURIComponent(did)}/versions`, { note }),
    attachDocument: (pid, did, d) => call('PATCH', `${P(pid)}/documents/${encodeURIComponent(did)}`, d),
    createUser: (pid, email, role) => call('POST', P(pid) + '/users', { email, role }),
    patchUser: (pid, uid, patch) => call('PATCH', `${P(pid)}/users/${encodeURIComponent(uid)}`, patch),
    // assistant, évaluations, pilotage
    chat: (pid, b) => call('POST', P(pid) + '/chat', b, { timeout: 60000 }),
    discussions: (pid) => call('GET', P(pid) + '/discussions'),
    rate: (pid, mid, b) => call('POST', `${P(pid)}/messages/${encodeURIComponent(mid)}/note`, b),
    search: (pid, b) => call('POST', P(pid) + '/recherche', b, { timeout: 30000 }),
    indicators: (pid, per) => call('GET', `${P(pid)}/indicateurs?per=${encodeURIComponent(per)}`),
    followUp: (pid, nid, b) => call('PATCH', `${P(pid)}/notes/${encodeURIComponent(nid)}`, b),
    // gestion documentaire, compte, RGPD
    deleteDocument: (pid, did) => call('DELETE', `${P(pid)}/documents/${encodeURIComponent(did)}`),
    changePassword: (ancien, nouveau) => call('POST', '/api/me/password', { ancien, nouveau }),
    exportMine: () => call('GET', '/api/me/export'),
    anonymiseUser: (pid, uid) => call('POST', `${P(pid)}/users/${encodeURIComponent(uid)}/anonymiser`, {}),
    purgeConversations: (pid, jours) => call('POST', P(pid) + '/conversations/purge', { jours }),
  };
}
export const api = createApi();
