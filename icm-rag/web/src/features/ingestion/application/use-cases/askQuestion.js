import { formatServerReply } from '../../domain/serverReply.js';

export const makeAskQuestion = ({ gateway }) => async ({ question, project, onProgress }) => {
  onProgress('Recherche sur le serveur…');
  return formatServerReply(await gateway.ask(question, project));
};
