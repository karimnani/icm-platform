import { S } from '../../core/state.js';
import { esc } from '../../core/format.js';
import { setWorkerUrl } from '../../core/config.js';
import { getToken } from '../../core/api.js';

/** Monte le module src/features/ingestion dans l'écran « Ingestion RAG (serveur) ». */
export async function mountIngestionScreen() {
  const host = document.getElementById('ingestion-root'); if (!host) return;
  const url = document.getElementById('wurl');
  url.addEventListener('change', () => { setWorkerUrl(url.value.trim()); });
  try {
    const { mountIngestion } = await import('../ingestion/index.js');
    if (!document.body.contains(host)) return;
    mountIngestion(host, { getBaseUrl: () => url.value.trim(), getProject: () => S.project, allowPurge: S.role === 'admin', getToken });
  } catch (e) {
    host.innerHTML = '<p class="alert t-ko" role="alert">Module d\u2019ingestion indisponible : ' + esc(e.message) + '</p>';
  }
}
