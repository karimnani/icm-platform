import { formatServerReply } from '../../domain/serverReply.js';

export const makePurgeProject = ({ gateway, confirmer }) => async ({ project, onProgress }) => {
  const ok = confirmer.confirm(`⚠️ ATTENTION : Vous allez supprimer TOUS les documents et TOUS les vecteurs du projet « ${project} ».\n\nConfirmer la purge complète ?`);
  if (!ok) return { cancelled: true };
  onProgress('Purge complète en cours (Firebase + Vectorize)…');
  const reply = await gateway.purge(project);
  return { cancelled: false, report: formatServerReply(reply) };
};
