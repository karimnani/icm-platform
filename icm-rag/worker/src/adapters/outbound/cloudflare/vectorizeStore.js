import { withRetry, withTimeout } from '../../../application/services/resilience.js';

/** @returns {import('../../../application/ports/index.js').VectorStorePort} */
export function createVectorizeStore({ index, timeoutMs = 20000, retry = {} }) {
  const safe = (label, fn) => withRetry(() => withTimeout(fn, timeoutMs, label), retry);   // opérations idempotentes (identifiants déterministes)
  return {
    async upsert(records) {
      await safe('Vectorize upsert', () => index.upsert(records));
    },
    async query(vector, { topK, namespace }) {
      const res = await safe('Vectorize query', () => index.query(vector, { topK, namespace, returnMetadata: 'all' }));
      return (res && res.matches) || [];
    },
    async deleteByIds(ids) {
      await safe('Vectorize delete', () => index.deleteByIds(ids));
    }
  };
}
