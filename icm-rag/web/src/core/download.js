/** Téléchargement d'un contenu généré côté navigateur (CSV, JSON…). Sans effet hors navigateur. */
export function download(name, text, type = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** CSV lisible par Excel en français : séparateur « ; », BOM UTF-8, champs protégés. */
export const toCsv = (rows) => '\uFEFF' + rows.map((r) => r.map((c) => { const s = String(c == null ? '' : c); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
