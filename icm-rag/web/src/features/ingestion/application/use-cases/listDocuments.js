import { toDocumentSummary } from '../../domain/documentSummary.js';

export const makeListDocuments = ({ gateway }) => async ({ project }) => {
  const data = await gateway.list(project);
  if (!data.docs || !data.docs.length) return [];
  return data.docs.map(toDocumentSummary);
};
