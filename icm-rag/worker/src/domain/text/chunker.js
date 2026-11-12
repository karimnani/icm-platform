/**
 * Découpage d'un texte Markdown en morceaux avec recouvrement.
 * @param {string} md
 * @param {{size:number, overlap:number}} opts
 * @returns {{text:string, section:string, page?:number}[]}
 *
 * Numéro de page : renseigné UNIQUEMENT si le texte converti contient des sauts de page (\f) ; sinon le comportement est inchangé
 * (aucune clé `page`). La page d'un morceau est celle de son premier paragraphe.
 */
/**
 * Coupe un paragraphe plus long que `size` en morceaux de `size` caractères AU PLUS, en préférant une frontière naturelle
 * (fin de ligne — donc jamais au milieu d'une ligne de tableau —, sinon fin de phrase) dans le dernier tiers de la fenêtre.
 * Sans frontière trouvée : coupe franche (comportement historique). Aucun caractère n'est perdu ni ajouté.
 */
export function splitLong(p, size) {
  const out = [];
  let rest = p;
  while (rest.length > size) {
    const win = rest.slice(0, size), floor = Math.floor(size * 2 / 3);
    let cut = win.lastIndexOf('\n');
    if (cut < floor) { const m = [...win.matchAll(/[.!?;:]\s/g)].pop(); cut = m && m.index + 1 >= floor ? m.index + 1 : -1; }
    if (cut < floor) cut = size;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

export function chunkMarkdown(md, { size, overlap }) {
  const hasPages = md.includes('\f');
  const paras = [];
  (hasPages ? md.split('\f') : [md]).forEach((pg, i) => pg.replace(/\r/g, '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .forEach(p => paras.push({ p, page: hasPages ? i + 1 : undefined })));
  const chunks = [];
  let section = 'Introduction', buf = '', bsec = section, bpage, fresh = false;

  const push = () => {
    const t = buf.trim();
    if (t && fresh) chunks.push(bpage === undefined ? { text: t, section: bsec } : { text: t, section: bsec, page: bpage });
    fresh = false;
  };

  for (const { p, page } of paras) {
    const h = p.match(/^#{1,6}\s+(.+)/);
    if (h) section = h[1].slice(0, 100);

    const parts = p.length > size ? splitLong(p, size) : [p];
    for (const part of parts) {
      if (buf && buf.length + part.length + 2 > size) {
        push();
        buf = buf.slice(-overlap);
      }
      if (!fresh) { bsec = section; bpage = page; }
      buf += (buf ? '\n\n' : '') + part;
      fresh = true;
    }
  }
  push();
  return chunks;
}
