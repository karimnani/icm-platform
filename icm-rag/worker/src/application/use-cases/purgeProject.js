import { clean, documentHash } from '../../domain/text/identifiers.js';
import { deleteDocumentVectors, batchesFor } from '../services/vectorCleanup.js';

export function makePurgeProject({ vectorStore, catalog, settings }) {
  return async function purgeProject({ project }) {
    const proj = clean(project || settings.DEFAULT_PROJECT);

    // 1. Vecteurs de tous les documents enregistrés dans le catalogue
    let failed = 0;
    for (const hash of await catalog.listDocumentIds(proj)) {
      const known = typeof catalog.chunkCount === 'function' ? await catalog.chunkCount(proj, hash).catch(() => 0) : 0;
      failed += await deleteDocumentVectors(vectorStore, hash, {
        batchSize: settings.DELETE_BATCH_SIZE, batches: batchesFor(known, { batchSize: settings.DELETE_BATCH_SIZE, batches: settings.DELETE_BATCHES_PER_DOC })
      });
    }

    // 2. Anciens documents de test (1 paquet de 100 ids)
    for (const name of settings.LEGACY_TEST_DOCUMENTS) {
      const hash = await documentHash(proj, name);
      await deleteDocumentVectors(vectorStore, hash, { batchSize: settings.DELETE_BATCH_SIZE, batches: 1 });
    }

    // 3. Branche catalogue du projet
    await catalog.removeAll(proj);

    return { ok: true, message: `Le projet « ${proj} » a été intégralement purgé (Vectorize + Firebase).`,
      ...(failed ? { avertissement: 'Certains vecteurs n’ont pas pu être supprimés de l’index de recherche : relancez la purge.' } : {}) };
  };
}
