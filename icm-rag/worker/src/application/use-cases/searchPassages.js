import { retrieveHits } from './askQuestion.js';

/** Recherche sémantique (sans génération) : renvoie les passages les plus proches de la requête, avec leur score. */
export function makeSearchPassages({ embedder, vectorStore, settings }) {
  return async function searchPassages({ query, project, allowedDocIds }) {
    query = String(query || '').trim();
    if (!query) return [];
    const { hits } = await retrieveHits({ question: query, project, allowedDocIds, embedder, vectorStore, settings });
    return hits.slice(0, settings.SEARCH_RESULTS || 8).map((m) => ({
      doc: m.metadata.doc, ver: Number(m.metadata.ver) || 1, section: m.metadata.sec || '', page: Number(m.metadata.page) || null,
      score: Math.round(m.score * 100) / 100, extrait: String(m.metadata.text || '').replace(/\s+/g, ' ').slice(0, 280),
    }));
  };
}
