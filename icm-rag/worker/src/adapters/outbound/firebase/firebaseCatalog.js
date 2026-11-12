/**
 * Catalogue des documents dans Firebase Realtime Database : /icm/catalogue/{projet}/{id}.json
 * @returns {import('../../../application/ports/index.js').CatalogPort}
 */
export function createFirebaseCatalog({ baseUrl, fetchFn = (...a) => fetch(...a) }) {
  const branch = (project) => `${baseUrl}/icm/catalogue/${project}`;

  return {
    async list(project) {
      const res = await fetchFn(`${branch(project)}.json`);
      if (!res.ok) throw new Error('Firebase error status: ' + res.status);
      const data = await res.json();
      return data ? Object.values(data) : [];
    },

    async listDocumentIds(project) {
      const res = await fetchFn(`${branch(project)}.json`);
      const data = await res.json();
      if (!data) return [];
      return Object.values(data).map(item => item.id).filter(Boolean);
    },

    async save(project, entry) {
      const res = await fetchFn(`${branch(project)}/${entry.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      return { status: res.status };
    },

    async chunkCount(project, id) {
      try { const res = await fetchFn(`${branch(project)}/${id}.json`); if (!res.ok) return 0; const e = await res.json(); return Number(e && e.chunks) || 0; }
      catch { return 0; }
    },

    async titleOf(project, id) {
      try { const res = await fetchFn(`${branch(project)}/${id}.json`); if (!res.ok) return null; const e = await res.json(); return e && e.name ? e.name : null; }
      catch { return null; }
    },

    async remove(project, id) {
      await fetchFn(`${branch(project)}/${id}.json`, { method: 'DELETE' });
    },

    async removeAll(project) {
      await fetchFn(`${branch(project)}.json`, { method: 'DELETE' });
    }
  };
}
