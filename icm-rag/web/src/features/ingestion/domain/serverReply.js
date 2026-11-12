/** Mise en forme d'une réponse brute du serveur : JSON indenté, sinon « statut texte ». */
export function formatServerReply({ status, text }) {
  try { return JSON.stringify(JSON.parse(text), null, 2); }
  catch (e) { return status + ' ' + text; }
}
