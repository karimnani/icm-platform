const CACHE = 'icm-v3';
const FILES = [
  './', './index.html', './manifest.json', './icon-512.png', './css/app.css', './css/ingest-standalone.css', './ingest.html',
  // Application (modules ES) et module d'ingestion RAG
  './src/app/registry.js',
  './src/app/render.js',
  './src/app/router.js',
  './src/core/api.js',
  './src/core/config.js',
  './src/core/download.js',
  './src/core/treeImport.js',
  './src/core/format.js',
  './src/core/history.js',
  './src/core/icons.js',
  './src/core/navigation.js',
  './src/core/mapping.js',
  './src/core/node.js',
  './src/core/projectData.js',
  './src/core/referentials.js',
  './src/core/remote.js',
  './src/core/seeds/grenoble.js',
  './src/core/seeds/index.js',
  './src/core/seeds/lyon.js',
  './src/core/session.js',
  './src/core/state.js',
  './src/core/tree.js',
  './src/features/accounts/actions.js',
  './src/features/accounts/index.js',
  './src/features/accounts/view.js',
  './src/features/assistant/actions.js',
  './src/features/assistant/adapters/workerChatGateway.js',
  './src/features/assistant/conversation.js',
  './src/features/assistant/domain/chatReply.js',
  './src/features/assistant/index.js',
  './src/features/assistant/view.js',
  './src/features/auth/actions.js',
  './src/features/auth/index.js',
  './src/features/auth/view.js',
  './src/features/connectors/actions.js',
  './src/features/connectors/index.js',
  './src/features/connectors/view.js',
  './src/features/documents/actions.js',
  './src/features/documents/index.js',
  './src/features/documents/view.js',
  './src/features/history/actions.js',
  './src/features/history/index.js',
  './src/features/history/view.js',
  './src/features/ingestion-screen/index.js',
  './src/features/ingestion-screen/mount.js',
  './src/features/ingestion-screen/upload.js',
  './src/features/ingestion-screen/view.js',
  './src/features/ingestion/adapters/inbound/ui/controller.js',
  './src/features/ingestion/adapters/inbound/ui/documentTableView.js',
  './src/features/ingestion/adapters/inbound/ui/template.js',
  './src/features/ingestion/adapters/outbound/browser/mammothWordReader.js',
  './src/features/ingestion/adapters/outbound/browser/scriptLoader.js',
  './src/features/ingestion/adapters/outbound/browser/sheetjsSpreadsheetReader.js',
  './src/features/ingestion/adapters/outbound/browser/windowConfirmer.js',
  './src/features/ingestion/adapters/outbound/http/httpRagGateway.js',
  './src/features/ingestion/application/ports/index.js',
  './src/features/ingestion/application/use-cases/askQuestion.js',
  './src/features/ingestion/application/use-cases/deleteDocument.js',
  './src/features/ingestion/application/use-cases/ingestFile.js',
  './src/features/ingestion/application/use-cases/listDocuments.js',
  './src/features/ingestion/application/use-cases/purgeProject.js',
  './src/features/ingestion/domain/documentSummary.js',
  './src/features/ingestion/domain/fileFormats.js',
  './src/features/ingestion/domain/serverReply.js',
  './src/features/ingestion/domain/spreadsheetMarkdown.js',
  './src/features/ingestion/index.js',
  './src/features/ingestion/styles.css',
  './src/features/integration/actions.js',
  './src/features/integration/index.js',
  './src/features/integration/ticker.js',
  './src/features/integration/uploader.js',
  './src/features/indicators/actions.js',
  './src/features/indicators/index.js',
  './src/features/indicators/view.js',
  './src/features/profile/actions.js',
  './src/features/profile/index.js',
  './src/features/profile/view.js',
  './src/features/integration/view.js',
  './src/features/interventions/actions.js',
  './src/features/interventions/index.js',
  './src/features/interventions/view.js',
  './src/features/projects/actions.js',
  './src/features/projects/index.js',
  './src/features/projects/view.js',
  './src/features/validation/actions.js',
  './src/features/validation/index.js',
  './src/features/validation/view.js',
  './src/main.js',
  './src/standalone/ingest-main.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // Firebase, polices Google et autres domaines : jamais interceptés
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  // Données de l'API et routes RAG : jamais mises en cache (aucune donnée d'usine persistée dans le navigateur)
  if (u.pathname.startsWith('/api/') || u.pathname === '/ingest') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return res; })
      .catch(() => caches.match(e.request).then((hit) => hit || new Response('Hors ligne : ressource non disponible.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
  );
});
