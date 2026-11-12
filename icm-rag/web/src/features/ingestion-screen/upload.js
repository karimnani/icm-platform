import { workerUrl } from '../../core/config.js';
import { getToken } from '../../core/api.js';

/** Envoi d'un document au Worker (lecture → extraction → indexation). Partagé par « Intégration documentaire » et « Nouvelle version ». */
export const ACCEPT = '.pdf,.docx,.xlsx,.xls';

/** Envoie un fichier au Worker ; lève une Error avec le message du serveur en cas d'échec (jamais de succès simulé). */
export async function sendToServer(file, { project, version = '1', name, note }) {
  const [{ buildIngestPayload }, { createHttpRagGateway }, { createMammothWordReader }, { createSheetJsSpreadsheetReader }] = await Promise.all([
    import('../ingestion/application/use-cases/ingestFile.js'), import('../ingestion/adapters/outbound/http/httpRagGateway.js'),
    import('../ingestion/adapters/outbound/browser/mammothWordReader.js'), import('../ingestion/adapters/outbound/browser/sheetjsSpreadsheetReader.js')]);
  const gateway = createHttpRagGateway({ getBaseUrl: () => String(workerUrl()).trim().replace(/\/+$/, ''), getToken });
  const payload = await buildIngestPayload({ file, project, version, name, note, wordReader: createMammothWordReader(), spreadsheetReader: createSheetJsSpreadsheetReader() });
  let raw;
  try { raw = await gateway.ingest(payload); } catch (e) { throw new Error('Serveur injoignable : vérifiez la connexion et l’adresse du Worker.'); }
  if (raw.status >= 400) { let m = ''; try { m = JSON.parse(raw.text).error; } catch (e) { /* corps non JSON */ } throw new Error(m || `Le serveur a répondu ${raw.status}.`); }
}

/** Lignes de la 1re feuille d'un classeur Excel (objets indexés par l'en-tête). Chargé à la demande (SheetJS). */
export async function readSheetRows(file) {
  const { createSheetJsSpreadsheetReader } = await import('../ingestion/adapters/outbound/browser/sheetjsSpreadsheetReader.js');
  const wb = await createSheetJsSpreadsheetReader().read(file);
  return wb.rowsOf(wb.sheetNames[0]);
}
