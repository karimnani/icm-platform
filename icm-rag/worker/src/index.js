import { buildApp } from './composition/buildApp.js';
import { applyCors } from './adapters/inbound/http/corsPolicy.js';
import { json } from './adapters/inbound/http/responses.js';
import { classifyInfraError, refId } from './application/services/resilience.js';

export default {
  async fetch(request, env) {
    try {
      return applyCors(await buildApp(env).handle(request), request, env);   // CORS restreint seulement si ALLOWED_ORIGIN est défini
    } catch (e) {
      // Filet de sécurité : jamais d'erreur 1101 brute — réponse JSON avec CORS et référence retrouvable dans les journaux du Worker
      const ref = refId(), c = classifyInfraError(e);
      console.error('[' + ref + '] exception non gérée', e);
      return applyCors(json({ ok: false, error: c.message, ref }, c.status), request, env);
    }
  },
  /** Conservation des données (RGPD) : tâche planifiée OPTIONNELLE (voir wrangler.toml, section [triggers]). */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.resolve().then(() => buildApp(env).retention()).catch((e) => console.error('tâche planifiée en échec :', e)));
  },
};
