import { withTimeout } from '../../../application/services/resilience.js';

/** @returns {import('../../../application/ports/index.js').LlmPort} */
export function createWorkersAiLlm({ ai, model, timeoutMs = 50000 }) {
  return {
    async generate({ messages, maxTokens }) {
      const out = await withTimeout(() => ai.run(model, { messages, max_tokens: maxTokens }), timeoutMs, 'Génération');
      return out && out.response;
    }
  };
}
