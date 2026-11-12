/** Fonctions pures d'identification (projet, document, hash). */
export const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60);

export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');

export async function shortHash(s) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Identifiant stable d'un document au sein d'un projet. */
export const documentHash = (project, docName) => shortHash(project + '/' + slug(docName));
