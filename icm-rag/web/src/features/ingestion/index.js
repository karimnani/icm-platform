import { createHttpRagGateway } from './adapters/outbound/http/httpRagGateway.js';
import { createMammothWordReader } from './adapters/outbound/browser/mammothWordReader.js';
import { createSheetJsSpreadsheetReader } from './adapters/outbound/browser/sheetjsSpreadsheetReader.js';
import { createWindowConfirmer } from './adapters/outbound/browser/windowConfirmer.js';
import { createDocumentTableView } from './adapters/inbound/ui/documentTableView.js';
import { renderTemplate } from './adapters/inbound/ui/template.js';
import { bindIngestionUi } from './adapters/inbound/ui/controller.js';
import { makeListDocuments } from './application/use-cases/listDocuments.js';
import { makeDeleteDocument } from './application/use-cases/deleteDocument.js';
import { makePurgeProject } from './application/use-cases/purgeProject.js';
import { makeIngestFile } from './application/use-cases/ingestFile.js';
import { makeAskQuestion } from './application/use-cases/askQuestion.js';

const STYLE_ID = 'icm-ingest-styles';
function ensureStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('./styles.css', import.meta.url).href;
  document.head.appendChild(link);
}

/**
 * Monte l'écran « Intégration documentaire » (liste, ajout, purge, test de question) dans `root`.
 *
 * @param {HTMLElement} root
 * @param {Object} opts
 * @param {() => string}  opts.getBaseUrl  URL du Worker (la MÊME que celle utilisée par le chatbot de l'app)
 * @param {() => string}  opts.getProject  identifiant du projet actif (ex. 'lyon') — doit être celui du chatbot
 * @param {boolean} [opts.allowPurge=true] false pour masquer « Purger toute la base » (ex. rôle Technicien)
 * @returns {{refresh:() => Promise<void>, destroy:() => void}}
 */
export function mountIngestion(root, { getBaseUrl, getProject, allowPurge = true, getToken } = {}) {
  if (!root) throw new Error('mountIngestion : élément racine manquant.');
  if (typeof getBaseUrl !== 'function' || typeof getProject !== 'function') {
    throw new Error('mountIngestion : getBaseUrl et getProject doivent être des fonctions.');
  }

  ensureStylesheet();
  root.classList.add('icm-ingest');
  root.innerHTML = renderTemplate({ allowPurge });
  const refs = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map(el => [el.dataset.ref, el]));

  const gateway = createHttpRagGateway({ getBaseUrl: () => String(getBaseUrl()).replace(/\/+$/, ''), getToken });
  const confirmer = createWindowConfirmer();
  const useCases = {
    listDocuments: makeListDocuments({ gateway }),
    deleteDocument: makeDeleteDocument({ gateway, confirmer }),
    purgeProject: makePurgeProject({ gateway, confirmer }),
    ingestFile: makeIngestFile({
      gateway, wordReader: createMammothWordReader(), spreadsheetReader: createSheetJsSpreadsheetReader()
    }),
    askQuestion: makeAskQuestion({ gateway }),
  };

  const ui = bindIngestionUi({ refs, view: createDocumentTableView(refs.tableWrap), useCases, getProject });
  ui.loadList();

  return {
    refresh: ui.loadList,
    destroy() { root.innerHTML = ''; root.classList.remove('icm-ingest'); },
  };
}
