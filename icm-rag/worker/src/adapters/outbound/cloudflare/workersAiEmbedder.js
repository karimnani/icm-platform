import { withRetry, withTimeout } from '../../../application/services/resilience.js';

/** @returns {import('../../../application/ports/index.js').EmbeddingPort} */
export function createWorkersAiEmbedder({ ai, model, batchSize, timeoutMs = 30000, retry = {} }) {
  return {
    async embed(texts) {
      const out = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        // Calcul d'empreintes = idempotent : une panne passagère (capacité, délai) est retentée une fois
        const r = await withRetry(() => withTimeout(() => ai.run(model, { text: texts.slice(i, i + batchSize) }), timeoutMs, 'Embedding'), retry);
        if (r && r.data) out.push(...r.data);
      }
      return out;
    }
  };
}
