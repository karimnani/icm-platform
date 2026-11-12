import { formatServerReply } from '../../domain/serverReply.js';
import { spreadsheetToMarkdown } from '../../domain/spreadsheetMarkdown.js';
import { extensionOf, isExcel, isWord, isPdf, MIN_TEXT_LENGTH } from '../../domain/fileFormats.js';

/** Prépare l'envoi : extrait le texte côté navigateur (Word/Excel) ou transmet le PDF tel quel. Lève une Error lisible si le fichier est inexploitable. */
export async function buildIngestPayload({ file, project, version, name, note, wordReader, spreadsheetReader }) {
    const payload = { project, version: version || '1', name: name || file.name, ...(note ? { note } : {}) };
    const ext = extensionOf(file.name);

    if (isExcel(ext)) {
      const text = spreadsheetToMarkdown(await spreadsheetReader.read(file), file.name);
      if (!text || text.trim().length < MIN_TEXT_LENGTH) throw new Error('Classeur vide.');
      payload.text = text;
    } else if (isWord(ext)) {
      const text = await wordReader.extractRawText(file);
      if (!text || text.trim().length < MIN_TEXT_LENGTH) throw new Error('Document Word vide.');
      payload.text = text;
    } else if (isPdf(ext)) {
      payload.file = file;
    } else {
      throw new Error('Format non supporté.');
    }

    return payload;
}

/** Extrait le texte côté navigateur (Word/Excel) ou transmet le PDF tel quel, puis envoie au serveur. */
export const makeIngestFile = ({ gateway, wordReader, spreadsheetReader }) =>
  async ({ file, project, version, onProgress }) => {
    const payload = await buildIngestPayload({ file, project, version, wordReader, spreadsheetReader });
    onProgress('Envoi et indexation au serveur…');
    return formatServerReply(await gateway.ingest(payload));
  };
