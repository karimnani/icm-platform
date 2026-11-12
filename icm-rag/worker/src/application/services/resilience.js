/**
 * Outils de tolérance aux pannes (purs, sans dépendance) : délai maximal, nouvelle tentative sur erreur TRANSITOIRE,
 * classification des erreurs d'infrastructure, identifiant de corrélation.
 */
import { ApplicationError } from '../errors.js';

export class TimeoutError extends Error {
  constructor(label, ms) { super(`${label} : délai dépassé (${ms} ms)`); this.name = 'TimeoutError'; }
}

const QUOTA = /daily|allocation|quota|exceeded your|used up/i;
const TRANSIENT = /capacity|temporar|overload|timeout|timed out|unavailable|busy|locked|rate.?limit|too many|\b(429|500|502|503|504)\b|network|fetch failed|reset|try again/i;

/** Une erreur « réessayable » : panne passagère d'infrastructure — jamais une erreur métier, jamais un quota journalier épuisé. */
export function isTransient(e) {
  if (!e || e instanceof ApplicationError) return false;
  if (e.name === 'TimeoutError') return true;
  const msg = String(e.message || e);
  if (QUOTA.test(msg)) return false;
  return [429, 500, 502, 503, 504].includes(Number(e.status)) || TRANSIENT.test(msg);
}

export const isQuotaError = (e) => !!e && !(e instanceof ApplicationError) && QUOTA.test(String(e.message || e));

/** Traduit une erreur inattendue en { status, message } restituables. Message générique inchangé pour une erreur inconnue. */
export function classifyInfraError(e) {
  if (e instanceof ApplicationError) return { status: e.status, message: e.message };
  if (isQuotaError(e)) return { status: 503, message: 'Quota du service IA atteint pour aujourd’hui : réessayez plus tard.' };
  if (isTransient(e)) return { status: 503, message: 'Service momentanément indisponible : réessayez dans quelques instants.' };
  return { status: 500, message: 'Erreur interne du serveur.' };
}

/** Rejette avec TimeoutError si `fn` ne répond pas dans `ms` (l'appel sous-jacent n'est pas annulé : Workers ne l'expose pas). */
export async function withTimeout(fn, ms, label = 'Appel') {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(fn), new Promise((_, rej) => { timer = setTimeout(() => rej(new TimeoutError(label, ms)), ms); })]);
  } finally { clearTimeout(timer); }
}

/** Réessaie `fn` (au plus `attempts` essais au total) si l'erreur est transitoire ; attente croissante. Réservé aux opérations IDEMPOTENTES. */
export async function withRetry(fn, { attempts = 2, delayMs = 250, shouldRetry = isTransient, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onRetry } = {}) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(i); }
    catch (e) {
      last = e;
      if (i >= attempts || !shouldRetry(e)) throw e;
      if (onRetry) onRetry(e, i);
      await sleep(delayMs * i);
    }
  }
  throw last;
}

/** Identifiant court de corrélation (journal Worker ⇄ message affiché à l'utilisateur). */
export const refId = () => crypto.randomUUID().slice(0, 8);

/** Purge planifiée : un projet en échec n'empêche pas les suivants ; renvoie le total et la liste des échecs. */
export async function purgeAllProjects(repo, days, { onError = () => {} } = {}) {
  let total = 0; const failed = [];
  for (const id of await repo.projectIds()) {
    try { total += await repo.purgeConversations(id, days); }
    catch (e) { failed.push(id); onError(id, e); }
  }
  return { total, failed };
}
