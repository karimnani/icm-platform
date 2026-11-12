import { formatServerReply } from '../../domain/serverReply.js';

export const makeDeleteDocument = ({ gateway, confirmer }) => async ({ name, project, onProgress }) => {
  if (!confirmer.confirm(`Confirmer la suppression définitive de « ${name} » ?`)) return { cancelled: true };
  onProgress('Suppression en cours sur le serveur…');
  const reply = await gateway.deleteDocument(project, name);
  return { cancelled: false, report: formatServerReply(reply) };
};
