import { vectorIdRange } from '../../domain/document/vectorIds.js';

/**
 * Suppression « au mieux » des vecteurs d'un document : une erreur n'interrompt PAS la suppression (comportement historique),
 * mais elle est désormais journalisée et comptée — l'appelant peut en avertir l'administrateur.
 * @param {import('../ports/index.js').VectorStorePort} vectorStore
 * @returns {Promise<number>} nombre de paquets dont la suppression a échoué
 */
export async function deleteDocumentVectors(vectorStore, hash, { batchSize, batches }) {
  let failed = 0;
  for (let b = 0; b < batches; b++) {
    const ids = vectorIdRange(hash, b * batchSize, batchSize);
    try { await vectorStore.deleteByIds(ids); }
    catch (e) { failed++; console.error('Vectorize : suppression des vecteurs échouée (' + hash + ', paquet ' + b + ') :', e && e.message ? e.message : e); }
  }
  return failed;
}

/** Nombre de paquets nécessaires pour couvrir `chunkCount` vecteurs connus (jamais moins que le minimum historique). */
export const batchesFor = (chunkCount, { batchSize, batches }) => Math.max(batches, Math.ceil((Number(chunkCount) || 0) / batchSize));

/** Identifiants des vecteurs devenus orphelins quand un document passe de `oldCount` à `newCount` morceaux. */
export const surplusRange = (hash, newCount, oldCount) => (oldCount > newCount ? vectorIdRange(hash, newCount, oldCount - newCount) : []);
