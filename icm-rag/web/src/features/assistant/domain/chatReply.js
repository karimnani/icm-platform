/** Règles pures de l'Assistant IA : conversion d'une réponse du Worker en message, libellés, erreurs. */

export class ChatError extends Error {}

/**
 * Réponse du Worker { response, sources: [[document, version, section, extrait], ...] }
 * → message de l'interface { t, src: [[document, version, section, extrait], ...] }.
 */
export function toAssistantMessage(payload) {
  if (!payload || typeof payload !== 'object') throw new ChatError('Réponse inattendue du serveur.');
  if (payload.error) throw new ChatError(String(payload.error));
  const t = String(payload.response == null ? '' : payload.response).trim();
  if (!t) throw new ChatError('Le serveur a renvoyé une réponse vide.');
  const src = (Array.isArray(payload.sources) ? payload.sources : [])
    .filter((s) => Array.isArray(s) && s[0])
    .map((s) => { const a = [String(s[0]), Number(s[1]) || 1, s[2] == null ? '' : String(s[2]), s[3] == null ? '' : String(s[3])]; if (Number(s[4]) > 0) a.push(Number(s[4])); return a; });
  const out = { t, src };   // identifiants serveur de la conversation enregistrée : seulement s'ils existent
  if (payload.message_id) out.mid = String(payload.message_id);
  if (payload.discussion_id) out.did = String(payload.discussion_id);
  return out;
}

/**
 * Localisation d'une source : un numéro est une page (données de démonstration),
 * un texte est le titre de la section renvoyé par le serveur ; « — » ou vide = inconnu.
 */
export function sourceLocator(loc) {
  const s = String(loc == null ? '' : loc).trim();
  if (!s || s === '—') return '';
  return /^\d+$/.test(s) ? 'page ' + s : 'section « ' + s + ' »';
}

/** Même localisation, en abrégé, pour la liste des signalements (« · p. 4 » ou « · § Titre »). */
export function signalLocator(loc) {
  const s = String(loc == null ? '' : loc).trim();
  if (!s || s === '—') return '';
  return /^\d+$/.test(s) ? ' · p. ' + s : ' · § ' + s;
}

/** Message affiché à l'utilisateur quand la réponse n'a pas pu être obtenue. */
export const describeFailure = (err) => (err instanceof ChatError ? err.message : 'Erreur inattendue : ' + (err && err.message ? err.message : err));
