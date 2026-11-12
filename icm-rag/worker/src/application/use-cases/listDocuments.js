import { clean } from '../../domain/text/identifiers.js';

export function makeListDocuments({ catalog, settings }) {
  return async function listDocuments({ project }) {
    return catalog.list(clean(project || settings.DEFAULT_PROJECT));
  };
}
