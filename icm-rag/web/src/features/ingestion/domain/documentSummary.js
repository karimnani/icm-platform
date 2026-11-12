/** Valeurs d'affichage par défaut d'une fiche document du serveur. */
export function toDocumentSummary(d) {
  return {
    title: d.name || d.doc || 'Document',
    version: d.ver || 1,
    chunks: d.chunks || '—',
    date: d.date || '—',
  };
}
