import { ApplicationError } from '../../../application/errors.js';

/** @returns {import('../../../application/ports/index.js').DocumentConverterPort} */
export function createWorkersAiConverter({ ai }) {
  return {
    async toMarkdown(file) {
      let r;
      try {
        const buf = await file.arrayBuffer();
        r = await ai.toMarkdown({ name: file.name, blob: new Blob([buf], { type: 'application/pdf' }) });
      } catch (e) {
        if (e instanceof ApplicationError) throw e;
        console.error('conversion du document :', e);
        throw new ApplicationError('Conversion du document indisponible pour le moment : réessayez. (' + (e && e.message ? e.message : 'erreur inconnue') + ')', 502);
      }
      if (Array.isArray(r)) r = r[0];
      if (!r || r.format === 'error') {
        throw new ApplicationError('Impossible de lire le texte de ce PDF.', 422);
      }
      return r.data || '';
    }
  };
}
