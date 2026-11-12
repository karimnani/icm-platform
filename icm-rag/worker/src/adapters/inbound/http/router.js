import { cors, json } from './responses.js';
import { SERVICE_NAME } from '../../../config/constants.js';
import { ApplicationError } from '../../../application/errors.js';
import { classifyInfraError, refId } from '../../../application/services/resilience.js';

/** Table de routage : une seule responsabilité, dispatcher vers les handlers. */
export function createRouter(handlers) {
  return async function handle(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const { pathname: path } = new URL(request.url);
    if (path.startsWith('/api/') && handlers.api) return handlers.api(request);   // API applicative (D1)
    if (request.method === 'GET') return json({ status: 'ok', service: SERVICE_NAME });

    try {
      const { pathname } = new URL(request.url);
      const post = request.method === 'POST';

      if (pathname === '/ingest' && post) return await handlers.ingest(request);   // Route 1
      if (pathname === '/list' && post) return await handlers.list(request);       // Route 2
      if (pathname === '/delete' && post) return await handlers.remove(request);   // Route 3
      if (pathname === '/purge' && post) return await handlers.purge(request);     // Route 3bis

      // Route 4 : chat documentaire RAG
      const body = await request.json().catch(() => ({}));
      if (body.action === 'chat') return await handlers.chat(body, request);

      return json({ error: 'Route non reconnue.' }, 400);
    } catch (e) {
      if (e instanceof ApplicationError) return json({ error: e.message }, e.status);
      const ref = refId(); console.error('[' + ref + ']', e);
      return json({ error: e.message, ref }, classifyInfraError(e).status);
    }
  };
}
