/**
 * CatalogPort sur D1 : remplace firebaseCatalog. Un document du catalogue = une ligne `document` (id = hash stable)
 * + une ligne `document_version` par numéro de version. Le projet RAG (« lyon ») est la clé `projet.id`.
 * @returns {import('../../../application/ports/index.js').CatalogPort}
 */
export const DEFAULT_TYPE_ID = 'type-8'; // « Document général de maintenance » (cf. seed.sql)

export function createD1Catalog({ db }) {
  const q = (sql, ...p) => db.prepare(sql).bind(...p);
  const toEntry = (r) => ({ id: r.id, name: r.name, ver: String(r.ver), chunks: r.chunks, chars: r.chars, date: r.date });
  const LATEST = `SELECT d.id, d.titre AS name, v.numero AS ver, v.chunks, v.chars, substr(v.created_at,1,10) AS date
    FROM document d JOIN document_version v ON v.document_id = d.id
    WHERE d.projet_id = ? AND v.numero = (SELECT MAX(numero) FROM document_version WHERE document_id = d.id)
    ORDER BY d.created_at DESC`;

  return {
    async list(project) {
      const { results } = await q(LATEST, project).all();
      return results.map((r) => ({ ...toEntry(r), date: r.date.split('-').reverse().join('/') }));
    },
    async listDocumentIds(project) {
      const { results } = await q('SELECT id FROM document WHERE projet_id = ?', project).all();
      return results.map((r) => r.id);
    },
    async save(project, entry) {
      const numero = Number.parseInt(entry.ver, 10) || 1;
      const proj = await q('SELECT id FROM projet WHERE id = ?', project).first();
      if (!proj) throw new Error(`Projet « ${project} » inconnu dans la base (table projet).`);
      const existing = await q('SELECT id FROM document_version WHERE document_id = ? AND numero = ?', entry.id, numero).first();
      await db.batch([
        q(`INSERT INTO document (id, titre, qualification, projet_id, type_id) VALUES (?, ?, 'indexe', ?, ?)
           ON CONFLICT(id) DO UPDATE SET titre = excluded.titre, qualification = CASE WHEN qualification = 'valide' THEN 'indexe' ELSE qualification END`,
          entry.id, entry.name, project, DEFAULT_TYPE_ID),
        existing
          ? q('UPDATE document_version SET chunks = ?, chars = ? WHERE id = ?', entry.chunks, entry.chars, existing.id)
          : q('INSERT INTO document_version (id, numero, document_id, chunks, chars, note_changement) VALUES (?, ?, ?, ?, ?, ?)',
              crypto.randomUUID(), numero, entry.id, entry.chunks, entry.chars, entry.note || (numero === 1 ? 'Création du document' : 'Nouvelle version')),
      ]);
      return { status: 200 };
    },
    /** Plus grand nombre de morceaux indexé pour ce document (toutes versions) : sert à purger les vecteurs excédentaires. */
    async chunkCount(project, id) {
      const r = await q('SELECT MAX(v.chunks) AS n FROM document_version v JOIN document d ON d.id = v.document_id WHERE d.id = ? AND d.projet_id = ?', id, project).first();
      return Number(r && r.n) || 0;
    },
    /** Titre enregistré pour cet identifiant (détection de collision d'identifiants), ou null. */
    async titleOf(project, id) {
      const r = await q('SELECT titre FROM document WHERE id = ? AND projet_id = ?', id, project).first();
      return r ? r.titre : null;
    },
    async remove(project, id) { await q('DELETE FROM document WHERE id = ? AND projet_id = ?', id, project).run(); },
    async removeAll(project) { await q('DELETE FROM document WHERE projet_id = ?', project).run(); },
  };
}
