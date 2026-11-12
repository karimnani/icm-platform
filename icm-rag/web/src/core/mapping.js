/** Fonctions PURES : réponse de l'API (D1) → structures attendues par l'interface (mêmes formes que les seeds). */
const pad = (n) => String(n).padStart(2, '0');
const asDate = (s) => (s ? new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z') : null); // SQLite : UTC
export const fmtDate = (s) => { if (!s) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/'); const d = asDate(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtDateTime = (s) => { const d = asDate(s); return d ? `${fmtDate(s)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; };
export const roleKey = (r) => (r === 'Admin' ? 'admin' : 'technicien');
export const formatOf = (name) => {
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  return { pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', csv: 'Excel', png: 'Image', jpg: 'Image', jpeg: 'Image', webp: 'Image' }[ext] || ext.toUpperCase() || 'Fichier';
};

/** Évaluation de l'utilisateur (libellé affiché) ⇄ niveau stocké en base. */
export const NIVEAU = { 'Oui, réponse satisfaisante': 'satisfaisante', 'Partiellement': 'partielle', 'Non, réponse incorrecte': 'incorrecte' };
const NIVEAU_LBL = Object.fromEntries(Object.entries(NIVEAU).map(([k, v]) => [v, k]));

/** Conversations enregistrées (API) → { convs, fb } au format de l'Assistant (mêmes formes que les conversations en direct). */
export function mapConversations(list) {
  const fb = {}, todayIso = new Date().toISOString().slice(0, 10);
  const convs = list.map((d) => ({
    id: d.id, sid: d.id, title: (d.prompt || 'Conversation').length > 34 ? d.prompt.slice(0, 34) + '…' : (d.prompt || 'Conversation'),
    date: String(d.created_at || '').slice(0, 10) === todayIso ? "Aujourd'hui" : fmtDate(d.created_at),
    msgs: d.messages.map((m) => {
      if (m.role === 'user') return { id: m.id, u: true, t: m.contenu };
      if (m.note) fb[m.id] = { sent: true, e: NIVEAU_LBL[m.note.niveau_utile] || m.note.niveau_utile, m: m.note.motif || '' };
      return { id: m.id, mid: m.id, u: false, t: m.contenu, src: m.citations.map((c) => [c.doc || 'Document supprimé', c.ver || 1, c.section || '', c.extrait || '', ...(c.page ? [c.page] : [])]) };
    }),
  }));
  return { convs, fb };
}

export const mapDocs = (rows) => rows.map((r) => ({
  id: r.id, n: r.titre, v: r.numero, d: fmtDate(r.version_date), f: formatOf(r.titre), type: r.type, node: r.node || null, q: r.qualification,
  txt: [r.titre, r.txt || ''].join(' '), chg: r.note_changement || undefined,
  ex: r.extrait ? ['Extrait analysé par l’IA', r.extrait] : [r.titre, 'Aperçu non stocké en base : le contenu est indexé dans le moteur de recherche (Vectorize) et consultable via l’Assistant IA.'],
}));

const LBL = { validee: 'Validée', rejetee: 'Rejetée', corrigee: 'Corrigée puis validée' };
export function mapKnowledge(know, decisions) {
  return know.map((k, i) => ({
    id: i + 1, rid: k.id, a: k.sujet, r: k.relation, b: k.objet, doc: k.doc, v: k.ver, page: k.page || 1, hasPage: !!k.page,
    interp: k.interpretation_ia || '', know: k.texte_valide || '', st: k.statut,
    h: decisions.filter((x) => x.connaissance_id === k.id).map((x) => `${fmtDate(x.created_at)} · ${LBL[x.nouveau_statut] || x.nouveau_statut} par ${x.login}${x.motif ? ' — motif : ' + x.motif : ''}`),
  }));
}

export const mapReports = (rows) => rows.map((r) => ({ id: r.reference, rid: r.id, m: r.machine_id, d: fmtDate(r.date), pb: r.probleme, diag: r.diagnostic, trav: r.actions, h: r.duree ?? 0, etat: r.etat_final, by: r.auteur || '—', st: r.statut }));

export function mapLogs(rows) {
  const hist = rows.filter((l) => l.categorie === 'historique').map((l) => [fmtDateTime(l.created_at), l.action, l.element_type || '', l.detail || '', l.login, l.role || '—']);
  const logs = rows.map((l) => [fmtDateTime(l.created_at), Math.max(0, l.jours || 0), l.login, l.action, l.detail || l.element_type || '', l.status]);
  return { hist, logs };
}

export const mapUsers = (rows, projectName) => rows.map((u) => ({ id: u.id, m: u.email, r: u.role, p: projectName, l: u.last_login ? fmtDateTime(u.last_login) : 'Jamais', a: !!u.is_active }));
export const mapProjects = (list) => list.map((p) => ({ id: p.id, n: p.nom, date: fmtDate(p.created_at) }));

/** Bootstrap complet d'un projet → champs de D(). */
export function mapBootstrap(b, projectName) {
  return { tree: b.tree, docs: mapDocs(b.docs), crs: mapReports(b.reports), val: mapKnowledge(b.know, b.decisions), ...mapLogs(b.logs), users: mapUsers(b.users, projectName) };
}
