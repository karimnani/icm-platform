import * as C from '../config/constants.js';
import { createWorkersAiEmbedder } from '../adapters/outbound/cloudflare/workersAiEmbedder.js';
import { createWorkersAiLlm } from '../adapters/outbound/cloudflare/workersAiLlm.js';
import { createWorkersAiConverter } from '../adapters/outbound/cloudflare/workersAiConverter.js';
import { createVectorizeStore } from '../adapters/outbound/cloudflare/vectorizeStore.js';
import { createFirebaseCatalog } from '../adapters/outbound/firebase/firebaseCatalog.js';
import { createD1Catalog } from '../adapters/outbound/d1/d1Catalog.js';
import { createD1Repository } from '../adapters/outbound/d1/d1Repository.js';
import * as webCrypto from '../adapters/outbound/cloudflare/webCrypto.js';
import { createApiHandler } from '../adapters/inbound/http/apiHandler.js';
import { makeIngestDocument } from '../application/use-cases/ingestDocument.js';
import { makeListDocuments } from '../application/use-cases/listDocuments.js';
import { makeDeleteDocument } from '../application/use-cases/deleteDocument.js';
import { makePurgeProject } from '../application/use-cases/purgeProject.js';
import { makeAskQuestion } from '../application/use-cases/askQuestion.js';
import { makeSearchPassages } from '../application/use-cases/searchPassages.js';
import { makeRagAuthorize } from '../adapters/inbound/http/ragAuth.js';
import { createHttpHandlers } from '../adapters/inbound/http/handlers.js';
import { createRouter } from '../adapters/inbound/http/router.js';
import { makeHealthHandler } from '../adapters/inbound/http/health.js';
import { purgeAllProjects } from '../application/services/resilience.js';

/** Seul endroit qui connaît les implémentations concrètes : on y branche adaptateurs ⇄ use cases. */
export function buildApp(env) {
  const ai = env.IA || env.AI;
  const { settings } = C;

  const embedder = createWorkersAiEmbedder({ ai, model: C.EMBED_MODEL, batchSize: C.EMBED_BATCH_SIZE });
  const llm = createWorkersAiLlm({ ai, model: C.LLM_MODEL });
  const documentConverter = createWorkersAiConverter({ ai });
  const vectorStore = createVectorizeStore({ index: env.VECTORIZE });
  const db = env.DB || env.icm_database;   // liaison D1 (nom « DB », ou ancien nom « icm_database »)
  const catalog = db ? createD1Catalog({ db }) : createFirebaseCatalog({ baseUrl: C.FIREBASE_URL });
  const today = () => new Date().toLocaleDateString('fr-FR');

  const repo = db ? createD1Repository({ db }) : null;
  const deleteDocument = makeDeleteDocument({ vectorStore, catalog, settings });
  const askQuestion = makeAskQuestion({ embedder, vectorStore, llm, settings });
  const searchPassages = makeSearchPassages({ embedder, vectorStore, settings });
  // Contrôle d'accès des routes RAG : OPT-IN (RAG_REQUIRE_AUTH = "1" + AUTH_SECRET + D1). Sans cela, comportement historique inchangé.
  const authorize = repo && env.AUTH_SECRET && String(env.RAG_REQUIRE_AUTH || '') === '1'
    ? makeRagAuthorize({ repo, crypto: webCrypto, secret: env.AUTH_SECRET, defaultProject: C.DEFAULT_PROJECT }) : undefined;

  const handlers = createHttpHandlers({
    ingestDocument: makeIngestDocument({ documentConverter, embedder, vectorStore, catalog, settings, today }),
    listDocuments: makeListDocuments({ catalog, settings }),
    deleteDocument,
    purgeProject: makePurgeProject({ vectorStore, catalog, settings }),
    askQuestion,
    authorize,
    api: db ? createApiHandler({ repo, crypto: webCrypto, secret: env.AUTH_SECRET || '', askQuestion, searchPassages, deleteDocument })
            : async () => new Response(JSON.stringify({ ok: false, error: 'Base D1 non liée au Worker (liaison « DB »).' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }),
  });

  /** Purge planifiée : conversations plus anciennes que RETENTION_DAYS, tous projets (évaluations « À analyser » conservées). */
  async function retention() {
    if (!repo) return 0;
    const days = Math.max(30, Number(env.RETENTION_DAYS) || C.RETENTION_DAYS);
    const { total, failed } = await purgeAllProjects(repo, days, { onError: (id, e) => console.error('purge planifiée : projet « ' + id + ' » en échec :', e) });
    if (failed.length) console.error('purge planifiée : ' + failed.length + ' projet(s) en échec :', failed.join(', '));
    return total;
  }

  // Sonde de supervision : GET /api/health (le reste de /api/* est inchangé)
  const route = createRouter(handlers);
  const health = db ? makeHealthHandler({ db, hasAi: !!ai, hasVectorize: !!env.VECTORIZE, hasSecret: !!env.AUTH_SECRET }) : null;
  const handle = health
    ? (request) => (request.method === 'GET' && new URL(request.url).pathname === '/api/health' ? health(request) : route(request))
    : route;

  return { handle, retention };
}
