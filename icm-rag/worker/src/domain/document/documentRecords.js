import { vectorId } from './vectorIds.js';

/** Enregistrements prêts pour le magasin vectoriel. */
export function toVectorRecords({ hash, project, chunks, vectors, docName, version }) {
  return chunks.map((c, i) => ({
    id: vectorId(hash, i),
    namespace: project,
    values: vectors[i],
    metadata: { doc: docName, ver: version, sec: c.section || '—', text: c.text, ...(c.page ? { page: c.page } : {}) }
  }));
}

/** Fiche du catalogue (stockée dans Firebase). */
export function toCatalogEntry({ hash, docName, version, chunks, chars, date, note }) {
  return { id: hash, name: docName, ver: version, chunks, chars, date, ...(note ? { note } : {}) };
}
