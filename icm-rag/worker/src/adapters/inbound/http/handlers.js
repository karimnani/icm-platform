import { json } from './responses.js';
import { ApplicationError } from '../../../application/errors.js';

/** Traduit requêtes HTTP ⇄ use cases. Aucune logique métier ici. */
export function createHttpHandlers({ ingestDocument, listDocuments, deleteDocument, purgeProject, askQuestion, api, authorize = async () => {} }) {
  const withAppErrors = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApplicationError) return json({ error: e.message }, e.status);
      throw e;
    }
  };

  return {
    api,
    ingest: (request) => withAppErrors(async () => {
      const form = await request.formData();
      await authorize(request, form.get('project'), 'Admin');
      const result = await ingestDocument({
        file: form.get('file'),
        rawText: form.get('text'),
        name: form.get('name'),
        project: form.get('project'),
        version: form.get('version'),
        note: form.get('note'),
      });
      return json(result);
    }),

    list: async (request) => {
      const body = await request.json().catch(() => ({}));
      await authorize(request, body.project);
      try {
        const docs = await listDocuments({ project: body.project });
        return json({ ok: true, docs });
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    },

    remove: (request) => withAppErrors(async () => {
      const form = await request.formData();
      await authorize(request, form.get('project'), 'Admin');
      return json(await deleteDocument({ project: form.get('project'), docName: form.get('doc') }));
    }),

    purge: async (request) => {
      const form = await request.formData();
      await authorize(request, form.get('project'), 'Admin');
      try {
        return json(await purgeProject({ project: form.get('project') }));
      } catch (err) {
        return json({ ok: false, error: err.message }, 500);
      }
    },

    chat: async (body, request) => { await authorize(request, body.project); return json(await askQuestion(body)); },
  };
}
