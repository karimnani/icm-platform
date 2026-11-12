import { ApplicationError } from '../errors.js';
import { clean, documentHash } from '../../domain/text/identifiers.js';
import { deleteDocumentVectors, batchesFor } from '../services/vectorCleanup.js';

export function makeDeleteDocument({ vectorStore, catalog, settings }) {
  return async function deleteDocument({ project, docName }) {
    const proj = clean(project || settings.DEFAULT_PROJECT);
    if (!docName) throw new ApplicationError('Précisez le nom du document.', 400);

    const hash = await documentHash(proj, docName);
    // Nombre de morceaux connu AVANT de retirer la fiche (sinon un document de plus de 200 morceaux laissait des vecteurs orphelins).
    const known = typeof catalog.chunkCount === 'function' ? await catalog.chunkCount(proj, hash).catch(() => 0) : 0;
    const failed = await deleteDocumentVectors(vectorStore, hash, {
      batchSize: settings.DELETE_BATCH_SIZE, batches: batchesFor(known, { batchSize: settings.DELETE_BATCH_SIZE, batches: settings.DELETE_BATCHES_PER_DOC })
    });
    await catalog.remove(proj, hash);

    return { ok: true, message: `Document « ${docName} » définitivement supprimé.`,
      ...(failed ? { avertissement: 'Certains vecteurs n’ont pas pu être supprimés de l’index de recherche : relancez la suppression ou contactez l’exploitant.' } : {}) };
  };
}
