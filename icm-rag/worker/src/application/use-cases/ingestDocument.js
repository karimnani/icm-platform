import { ApplicationError } from '../errors.js';
import { clean, slug, documentHash } from '../../domain/text/identifiers.js';
import { chunkMarkdown } from '../../domain/text/chunker.js';
import { toVectorRecords, toCatalogEntry } from '../../domain/document/documentRecords.js';
import { surplusRange } from '../services/vectorCleanup.js';

/** Dépôt et indexation d'un document : conversion → découpage → embeddings → Vectorize + catalogue. */
export function makeIngestDocument({ documentConverter, embedder, vectorStore, catalog, settings, today }) {
  return async function ingestDocument({ file, rawText, name, project, version, note }) {
    const docName = name || (file ? file.name : 'document');
    const proj = clean(project || settings.DEFAULT_PROJECT);
    const ver = String(version || '1');

    let md = '';
    if (rawText && rawText.trim().length > 0) {
      md = rawText.trim();
    } else if (file && file.name) {
      md = await documentConverter.toMarkdown(file);
    } else {
      throw new ApplicationError('Fichier ou contenu manquant.', 400);
    }

    if (md.replace(/\s/g, '').length < settings.MIN_CONTENT_CHARS) {
      throw new ApplicationError('Contenu trop court pour être indexé.', 422);
    }

    const hash = await documentHash(proj, docName);
    // 0. Garde-fous, AVANT tout calcul IA (un refus ne consomme aucun quota) (catalogues qui les proposent ; sans effet sinon)
    //    - collision d'identifiant : même empreinte mais titre différent → refus plutôt qu'écrasement silencieux d'un autre document ;
    //    - nombre de morceaux déjà indexés : sert à purger les vecteurs excédentaires et à compenser un échec d'écriture du catalogue.
    if (typeof catalog.titleOf === 'function') {
      const existing = await catalog.titleOf(proj, hash).catch(() => null);
      if (existing && slug(existing) !== slug(docName)) {
        throw new ApplicationError(`Conflit d’identifiant : « ${docName} » produirait la même empreinte que le document existant « ${existing} ». Renommez le fichier.`, 409);
      }
    }
    const chunks = chunkMarkdown(md, { size: settings.CHUNK_SIZE, overlap: settings.CHUNK_OVERLAP });
    const vecs = await embedder.embed(chunks.map(c => c.text));
    if (!Array.isArray(vecs) || vecs.length !== chunks.length || vecs.some((v) => !v)) {
      throw new ApplicationError(`Calcul des empreintes sémantiques incomplet (${Array.isArray(vecs) ? vecs.length : 0}/${chunks.length}) : réessayez ; rien n’a été indexé.`, 502);
    }

    const previous = typeof catalog.chunkCount === 'function' ? await catalog.chunkCount(proj, hash).catch(() => null) : null;

    // 1. Vectorisation
    const records = toVectorRecords({ hash, project: proj, chunks, vectors: vecs, docName, version: ver });
    for (let i = 0; i < records.length; i += settings.UPSERT_BATCH_SIZE) {
      await vectorStore.upsert(records.slice(i, i + settings.UPSERT_BATCH_SIZE));
    }

    // 1bis. Nouvelle version plus courte : les anciens morceaux excédentaires ne doivent plus alimenter les réponses
    const surplus = surplusRange(hash, chunks.length, Number(previous) || 0);
    for (let i = 0; i < surplus.length; i += settings.DELETE_BATCH_SIZE) {
      try { await vectorStore.deleteByIds(surplus.slice(i, i + settings.DELETE_BATCH_SIZE)); }
      catch (e) { console.error('Vectorize : morceaux obsolètes non supprimés (' + hash + ') :', e && e.message ? e.message : e); }
    }

    // 2. Catalogue — s'il échoue pour un document NOUVEAU (aucun morceau antérieur connu), on retire les vecteurs qu'on vient d'écrire
    const entry = toCatalogEntry({ hash, docName, version: ver, chunks: chunks.length, chars: md.length, date: today(), note: note ? String(note).slice(0, 500) : undefined });
    let status;
    try { ({ status } = await catalog.save(proj, entry)); }
    catch (e) {
      if (previous === 0) {
        for (let i = 0; i < records.length; i += settings.DELETE_BATCH_SIZE) {
          await vectorStore.deleteByIds(records.slice(i, i + settings.DELETE_BATCH_SIZE).map((r) => r.id)).catch(() => {});
        }
      }
      throw e;
    }

    return {
      ok: true,
      doc: docName,
      version: ver,
      chunks: chunks.length,
      chars: md.length,
      firebaseStatus: status,
      message: `Document « ${docName} » indexé avec succès !`
    };
  };
}
