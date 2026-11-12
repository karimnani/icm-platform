import { ApplicationError } from '../errors.js';
import { clean, documentHash } from '../../domain/text/identifiers.js';
import {
  NO_ANSWER_MESSAGE, EMPTY_QUESTION_MESSAGE, EMBEDDING_ERROR_MESSAGE,
  SYSTEM_PROMPT, buildContext, buildUserPrompt, toSources
} from '../../domain/rag/answerPolicy.js';

/**
 * Passages retenus pour une question : embedding → recherche vectorielle → seuil de pertinence.
 * `allowedDocIds` (facultatif) limite la recherche à un périmètre de l'arborescence : on interroge plus large puis on ne garde
 * que les passages dont le document (identifiant = hash projet/nom) est autorisé. Absent → comportement historique inchangé.
 */
export async function retrieveHits({ question, project, allowedDocIds, embedder, vectorStore, settings }) {
  const proj = clean(project || settings.DEFAULT_PROJECT);
  const [qv] = await embedder.embed([question]);
  if (!qv) return { embedFailed: true, hits: [] };
  const scoped = Array.isArray(allowedDocIds) || allowedDocIds instanceof Set;
  const allowed = scoped ? new Set(allowedDocIds) : null;
  const topK = scoped ? Math.max(settings.TOP_K, settings.SCOPE_FETCH || settings.TOP_K) : settings.TOP_K;
  const matches = await vectorStore.query(qv, { topK, namespace: proj });
  let hits = matches.filter(m => m.score >= settings.MIN_SCORE);
  if (allowed) {
    const keep = [];
    for (const m of hits) if (allowed.has(await documentHash(proj, m.metadata && m.metadata.doc))) keep.push(m);
    hits = keep.slice(0, settings.TOP_K);
  }
  return { hits };
}

/** Chat documentaire RAG : embedding → recherche vectorielle → génération. */
export function makeAskQuestion({ embedder, vectorStore, llm, settings }) {
  return async function askQuestion({ question, project, allowedDocIds }) {
    question = String(question || '').trim();
    if (!question) return { response: EMPTY_QUESTION_MESSAGE, sources: [] };

    const { hits, embedFailed } = await retrieveHits({ question, project, allowedDocIds, embedder, vectorStore, settings });
    if (embedFailed) return { response: EMBEDDING_ERROR_MESSAGE, sources: [] };
    if (!hits.length) return { response: NO_ANSWER_MESSAGE, sources: [] };

    const out = await llm.generate({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(buildContext(hits), question) }
      ],
      maxTokens: settings.LLM_MAX_TOKENS,
    });

    const response = String(out || '').trim();
    if (!response) throw new ApplicationError('Le modèle de langage n’a renvoyé aucune réponse : réessayez.', 502);
    return { response, sources: toSources(hits) };
  };
}
