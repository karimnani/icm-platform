/** Requêtes SQL de l'API applicative (utilisateurs, projets, arborescence, rapports, connaissances, journal). */
const TABLES = { Site: 'site', Atelier: 'atelier', 'Ligne de production': 'ligne', Machine: 'machine' };
const PARENT = { Atelier: ['site_id', 'Site'], 'Ligne de production': ['atelier_id', 'Atelier'], Machine: ['ligne_id', 'Ligne de production'] };
export const NODE_TYPES = Object.keys(TABLES);

export function createD1Repository({ db }) {
  const q = (sql, ...p) => db.prepare(sql).bind(...p);
  const all = async (sql, ...p) => (await q(sql, ...p).all()).results || [];
  const first = (sql, ...p) => q(sql, ...p).first();
  const run = (sql, ...p) => q(sql, ...p).run();

  return {
    // ---------- comptes ----------
    userByLogin: (id) => first('SELECT * FROM user WHERE lower(email) = lower(?) OR lower(login) = lower(?)', id, id),
    userById: (id) => first('SELECT id, login, email, is_active FROM user WHERE id = ?', id),
    touchLogin: (id) => run("UPDATE user SET last_login = datetime('now') WHERE id = ?", id),
    projectsOf: (uid) => all('SELECT p.id, p.nom, p.created_at, a.role FROM affecter a JOIN projet p ON p.id = a.projet_id WHERE a.user_id = ? ORDER BY p.created_at, p.nom', uid),
    roleOf: async (uid, pid) => (await first('SELECT role FROM affecter WHERE user_id = ? AND projet_id = ?', uid, pid))?.role || null,
    projectExists: (id) => first('SELECT id FROM projet WHERE id = ?', id),
    createProject: (id, nom, uid) => db.batch([q('INSERT INTO projet (id, nom) VALUES (?, ?)', id, nom), q("INSERT INTO affecter (user_id, projet_id, role) VALUES (?, ?, 'Admin')", uid, id)]),
    usersOf: (pid) => all(`SELECT u.id, u.email, u.login, u.is_active, u.last_login, a.role FROM affecter a JOIN user u ON u.id = a.user_id WHERE a.projet_id = ? ORDER BY u.email`, pid),
    createUser: ({ id, login, email, hash, pid, role }) => db.batch([
      q('INSERT INTO user (id, login, email, password_hash) VALUES (?, ?, ?, ?)', id, login, email, hash),
      q('INSERT INTO affecter (user_id, projet_id, role) VALUES (?, ?, ?)', id, pid, role)]),
    assign: (uid, pid, role) => run('INSERT INTO affecter (user_id, projet_id, role) VALUES (?, ?, ?) ON CONFLICT(user_id, projet_id) DO UPDATE SET role = excluded.role', uid, pid, role),
    setActive: (uid, on) => run('UPDATE user SET is_active = ? WHERE id = ?', on ? 1 : 0, uid),
    userFull: (id) => first('SELECT * FROM user WHERE id = ?', id),
    setPassword: (uid, hash) => run('UPDATE user SET password_hash = ? WHERE id = ?', hash, uid),
    adminCount: async (pid) => (await first("SELECT COUNT(*) AS n FROM affecter a JOIN user u ON u.id = a.user_id WHERE a.projet_id = ? AND a.role = 'Admin' AND u.is_active = 1", pid)).n,

    // ---------- arborescence ----------
    async tree(pid) {
      const sites = await all('SELECT id, nom FROM site WHERE projet_id = ? ORDER BY nom', pid);
      const ateliers = await all('SELECT a.id, a.nom, a.site_id FROM atelier a JOIN site s ON s.id = a.site_id WHERE s.projet_id = ? ORDER BY a.nom', pid);
      const lignes = await all('SELECT l.id, l.nom, l.atelier_id FROM ligne l JOIN atelier a ON a.id = l.atelier_id JOIN site s ON s.id = a.site_id WHERE s.projet_id = ? ORDER BY l.nom', pid);
      const machines = await all('SELECT m.id, m.nom, m.ligne_id FROM machine m JOIN ligne l ON l.id = m.ligne_id JOIN atelier a ON a.id = l.atelier_id JOIN site s ON s.id = a.site_id WHERE s.projet_id = ? ORDER BY m.nom', pid);
      return { sites, ateliers, lignes, machines };
    },
    addNode: (type, { id, nom, parentId, pid }) => type === 'Site'
      ? run('INSERT INTO site (id, nom, projet_id) VALUES (?, ?, ?)', id, nom, pid)
      : run(`INSERT INTO ${TABLES[type]} (id, nom, ${PARENT[type][0]}) VALUES (?, ?, ?)`, id, nom, parentId),
    renameNode: (type, id, nom) => run(`UPDATE ${TABLES[type]} SET nom = ? WHERE id = ?`, nom, id),
    deleteNode: (type, id) => run(`DELETE FROM ${TABLES[type]} WHERE id = ?`, id),
    /** Documents et rapports qui seraient détachés / supprimés avec ces éléments (ids de tous niveaux). */
    async attachedCount(ids) {
      const j = JSON.stringify(ids), IN = '(SELECT value FROM json_each(?))';
      const d = await first(`SELECT COUNT(*) AS n FROM document WHERE site_id IN ${IN} OR atelier_id IN ${IN} OR ligne_id IN ${IN} OR machine_id IN ${IN}`, j, j, j, j);
      const r = await first(`SELECT COUNT(*) AS n FROM rapport WHERE machine_id IN ${IN}`, j);
      return { documents: d.n, rapports: r.n };
    },
    parentFieldOf: (type) => PARENT[type],

    // ---------- documents / connaissances / rapports ----------
    documents: (pid) => all(`SELECT d.id, d.titre, d.qualification, t.nom AS type, d.type_id,
        COALESCE(d.machine_id, d.ligne_id, d.atelier_id, d.site_id) AS node,
        v.numero, v.created_at AS version_date, v.type_mime, v.note_changement,
        (SELECT group_concat(c.sujet || ' ' || c.relation || ' ' || c.objet, ' ') FROM connaissance c JOIN document_version vv ON vv.id = c.document_version_id WHERE vv.document_id = d.id) AS txt,
        (SELECT c.interpretation_ia FROM connaissance c JOIN document_version vv ON vv.id = c.document_version_id WHERE vv.document_id = d.id ORDER BY c.created_at LIMIT 1) AS extrait
      FROM document d
      JOIN type_document t ON t.id = d.type_id
      JOIN document_version v ON v.document_id = d.id AND v.numero = (SELECT MAX(numero) FROM document_version WHERE document_id = d.id)
      WHERE d.projet_id = ? ORDER BY d.created_at DESC, d.titre`, pid),
    typeByName: (nom) => first('SELECT id FROM type_document WHERE nom = ?', nom),
    /** Type + rattachement d'un document (un seul niveau de l'arborescence renseigné à la fois). */
    attachDocument: (did, typeId, nodeType, nodeId) => run(
      'UPDATE document SET type_id = COALESCE(?, type_id), site_id = ?, atelier_id = ?, ligne_id = ?, machine_id = ? WHERE id = ?',
      typeId, nodeType === 'Site' ? nodeId : null, nodeType === 'Atelier' ? nodeId : null,
      nodeType === 'Ligne de production' ? nodeId : null, nodeType === 'Machine' ? nodeId : null, did),
    documentOf: (did) => first('SELECT id, projet_id, titre FROM document WHERE id = ?', did),
    async addVersion(did, note) {
      const n = (await first('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM document_version WHERE document_id = ?', did)).n;
      await db.batch([
        q('INSERT INTO document_version (id, numero, document_id, note_changement) VALUES (?, ?, ?, ?)', crypto.randomUUID(), n, did, note),
        q("UPDATE document SET qualification = 'indexe' WHERE id = ?", did)]);
      return n;
    },
    knowledge: (pid) => all(`SELECT c.id, c.sujet, c.relation, c.objet, c.interpretation_ia, c.texte_valide, c.page, c.statut, d.titre AS doc, v.numero AS ver, d.id AS document_id
      FROM connaissance c JOIN document_version v ON v.id = c.document_version_id JOIN document d ON d.id = v.document_id
      WHERE d.projet_id = ? ORDER BY c.created_at, c.id`, pid),
    decisions: (pid) => all(`SELECT x.connaissance_id, x.nouveau_statut, x.motif, x.created_at, u.login FROM decision x
      JOIN user u ON u.id = x.user_id JOIN connaissance c ON c.id = x.connaissance_id
      JOIN document_version v ON v.id = c.document_version_id JOIN document d ON d.id = v.document_id
      WHERE d.projet_id = ? ORDER BY x.created_at, x.rowid`, pid),
    knowledgeOf: (cid) => first(`SELECT c.*, d.projet_id, d.id AS document_id, d.titre AS doc FROM connaissance c JOIN document_version v ON v.id = c.document_version_id JOIN document d ON d.id = v.document_id WHERE c.id = ?`, cid),
    decide: ({ cid, ancien, nouveau, motif, uid, fields, documentId }) => db.batch([
      fields
        ? q('UPDATE connaissance SET statut = ?, sujet = ?, relation = ?, objet = ?, texte_valide = ? WHERE id = ?', nouveau, fields.sujet, fields.relation, fields.objet, fields.texte_valide, cid)
        : q('UPDATE connaissance SET statut = ? WHERE id = ?', nouveau, cid),
      q('INSERT INTO decision (id, ancien_statut, nouveau_statut, motif, connaissance_id, user_id) VALUES (?, ?, ?, ?, ?, ?)', crypto.randomUUID(), ancien, nouveau, motif || null, cid, uid),
      ...(nouveau === 'rejetee' ? [] : [q("UPDATE document SET qualification = 'valide' WHERE id = ?", documentId)])]),
    reports: (pid) => all(`SELECT r.id, r.reference, r.date, r.machine_id, r.probleme, r.diagnostic, r.actions, r.duree, r.etat_final, r.statut, u.login AS auteur
      FROM rapport r JOIN machine m ON m.id = r.machine_id JOIN ligne l ON l.id = m.ligne_id JOIN atelier a ON a.id = l.atelier_id JOIN site s ON s.id = a.site_id
      LEFT JOIN user u ON u.id = r.auteur_id WHERE s.projet_id = ? ORDER BY r.date DESC, r.created_at DESC, r.reference DESC`, pid),
    async nextReference() {
      const r = await first("SELECT COALESCE(MAX(CAST(substr(reference, 5) AS INTEGER)), 141) + 1 AS n FROM rapport WHERE reference LIKE 'INT-%'");
      return 'INT-' + String(r.n).padStart(4, '0');
    },
    addReport: (r) => run(`INSERT INTO rapport (id, reference, date, type, duree, probleme, diagnostic, actions, pieces, etat_final, auteur_id, machine_id)
      VALUES (?, ?, ?, 'Intervention', ?, ?, ?, ?, ?, ?, ?, ?)`, r.id, r.reference, r.date, r.duree, r.probleme, r.diagnostic, r.actions, r.pieces, r.etat_final, r.auteur_id, r.machine_id),

    // ---------- journal (historique métier + audit) ----------
    log: ({ categorie = 'historique', action, element, elementId, detail, status = 'Succès', loginSaisi, pid, uid }) => run(
      `INSERT INTO log (id, categorie, action, element_type, element_id, detail, status, login_saisi, projet_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(), categorie, action, element || null, elementId || null, detail || null, status, loginSaisi || null, pid || null, uid || null),
    logs: (pid, limit = 300) => all(`SELECT l.created_at, l.categorie, l.action, l.element_type, l.detail, l.status,
        COALESCE(u.login, l.login_saisi, 'système') AS login, a.role,
        CAST(julianday('now') - julianday(l.created_at) AS INTEGER) AS jours
      FROM log l LEFT JOIN user u ON u.id = l.user_id LEFT JOIN affecter a ON a.user_id = l.user_id AND a.projet_id = l.projet_id
      WHERE l.projet_id = ? ORDER BY l.created_at DESC, l.rowid DESC LIMIT ?`, pid, limit),

    projectIds: async () => (await all('SELECT id FROM projet')).map((p) => p.id),

    // ---------- périmètre de recherche (équipement) ----------
    /** Documents d'un projet utilisables pour un périmètre : rattachés aux éléments donnés (ancêtres + nœud + descendants) ou non rattachés. */
    async scopeDocIds(pid, nodeIds) {
      const rows = await all(`SELECT id FROM document WHERE projet_id = ?
        AND (COALESCE(machine_id, ligne_id, atelier_id, site_id) IS NULL OR COALESCE(machine_id, ligne_id, atelier_id, site_id) IN (SELECT value FROM json_each(?)))`, pid, JSON.stringify(nodeIds));
      return rows.map((r) => r.id);
    },

    // ---------- gestion documentaire ----------
    async knowledgeCountOfDocument(did) {
      return (await first('SELECT COUNT(*) AS n FROM connaissance c JOIN document_version v ON v.id = c.document_version_id WHERE v.document_id = ?', did)).n;
    },
    deleteDocument: (did, pid) => run('DELETE FROM document WHERE id = ? AND projet_id = ?', did, pid),

    // ---------- conversations, évaluations, indicateurs ----------
    versionIdOf: async (docId, numero) => (await first('SELECT id FROM document_version WHERE document_id = ? AND numero = ?', docId, numero))?.id || null,
    createDiscussion: ({ id, prompt, uid, pid }) => run('INSERT INTO discussion (id, prompt, user_id, projet_id) VALUES (?, ?, ?, ?)', id, prompt, uid, pid),
    discussionOf: (id) => first('SELECT id, prompt, user_id, projet_id FROM discussion WHERE id = ?', id),
    addMessage: ({ id, role, contenu, sansReponse, did }) => run('INSERT INTO message (id, role, contenu, sans_reponse, discussion_id) VALUES (?, ?, ?, ?, ?)', id, role, contenu, sansReponse ? 1 : 0, did),
    addCitation: ({ id, page, section, extrait, mid, versionId }) => run('INSERT INTO citation (id, page, section, extrait, message_id, document_version_id) VALUES (?, ?, ?, ?, ?, ?)', id, page || null, section || null, extrait || null, mid, versionId || null),
    messageOf: (mid) => first(`SELECT m.id, m.role, m.discussion_id, d.user_id, d.projet_id FROM message m JOIN discussion d ON d.id = m.discussion_id WHERE m.id = ?`, mid),
    noteOfMessage: (mid) => first('SELECT id FROM note WHERE message_id = ?', mid),
    addNote: ({ id, niveau, motif, commentaire, did, mid }) => run('INSERT INTO note (id, niveau_utile, motif, commentaire, discussion_id, message_id) VALUES (?, ?, ?, ?, ?, ?)', id, niveau, motif || null, commentaire || null, did, mid),
    noteOf: (nid) => first(`SELECT n.id, n.statut_suivi, d.projet_id FROM note n JOIN discussion d ON d.id = n.discussion_id WHERE n.id = ?`, nid),
    setNoteFollowUp: ({ nid, statut, commentaire, uid }) => run(`UPDATE note SET statut_suivi = ?, suivi_commentaire = ?, traite_par = ?, traite_at = CASE WHEN ? = 'À analyser' THEN NULL ELSE datetime('now') END WHERE id = ?`,
      statut, commentaire || null, statut === 'À analyser' ? null : uid, statut, nid),

    /** Conversations d'un utilisateur dans un projet, avec messages, sources et évaluation (les plus récentes d'abord). */
    async discussionsOf(pid, uid, limit = 40) {
      const ds = await all('SELECT id, prompt, created_at FROM discussion WHERE projet_id = ? AND user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?', pid, uid, limit);
      if (!ds.length) return [];
      const ids = JSON.stringify(ds.map((d) => d.id)), IN = '(SELECT value FROM json_each(?))';
      const [ms, cs, ns] = await Promise.all([
        all(`SELECT id, role, contenu, sans_reponse, created_at, discussion_id FROM message WHERE discussion_id IN ${IN} ORDER BY created_at, rowid`, ids),
        all(`SELECT c.message_id, c.page, c.section, c.extrait, d.titre AS doc, v.numero AS ver FROM citation c
             JOIN message m ON m.id = c.message_id LEFT JOIN document_version v ON v.id = c.document_version_id LEFT JOIN document d ON d.id = v.document_id
             WHERE m.discussion_id IN ${IN} ORDER BY c.rowid`, ids),
        all(`SELECT message_id, niveau_utile, motif, commentaire, statut_suivi FROM note WHERE discussion_id IN ${IN}`, ids),
      ]);
      return ds.map((d) => ({ ...d, messages: ms.filter((m) => m.discussion_id === d.id).map((m) => ({ ...m,
        citations: cs.filter((c) => c.message_id === m.id), note: ns.find((n) => n.message_id === m.id) || null })) }));
    },

    /** Tous les indicateurs de pilotage d'un projet sur une période (`days` = null → depuis toujours). */
    async indicators(pid, days) {
      const since = days ? `-${Number(days)} days` : '-100 years';
      const D = 'JOIN discussion d ON d.id = m.discussion_id WHERE d.projet_id = ? AND m.created_at >= datetime(\'now\', ?)';
      const [qn, jsp, ans, notes, motifs, top, quals, knows, inter, signals, pending] = await Promise.all([
        first(`SELECT COUNT(*) AS n FROM message m ${D} AND m.role = 'user'`, pid, since),
        first(`SELECT COUNT(*) AS n FROM message m ${D} AND m.role = 'assistant' AND m.sans_reponse = 1`, pid, since),
        first(`SELECT COUNT(*) AS n FROM message m ${D} AND m.role = 'assistant'`, pid, since),
        all(`SELECT n.niveau_utile AS k, COUNT(*) AS n FROM note n JOIN discussion d ON d.id = n.discussion_id WHERE d.projet_id = ? AND n.created_at >= datetime('now', ?) GROUP BY n.niveau_utile`, pid, since),
        all(`SELECT n.motif AS motif, COUNT(*) AS n FROM note n JOIN discussion d ON d.id = n.discussion_id WHERE d.projet_id = ? AND n.created_at >= datetime('now', ?) AND n.niveau_utile <> 'satisfaisante' AND n.motif IS NOT NULL GROUP BY n.motif ORDER BY n DESC`, pid, since),
        all(`SELECT d.titre AS doc, COUNT(*) AS n FROM citation c JOIN message m ON m.id = c.message_id JOIN discussion q ON q.id = m.discussion_id
             JOIN document_version v ON v.id = c.document_version_id JOIN document d ON d.id = v.document_id
             WHERE q.projet_id = ? AND m.created_at >= datetime('now', ?) GROUP BY d.id ORDER BY n DESC, d.titre LIMIT 5`, pid, since),
        all('SELECT qualification AS k, COUNT(*) AS n FROM document WHERE projet_id = ? GROUP BY qualification', pid),
        all(`SELECT c.statut AS k, COUNT(*) AS n FROM connaissance c JOIN document_version v ON v.id = c.document_version_id JOIN document d ON d.id = v.document_id WHERE d.projet_id = ? GROUP BY c.statut`, pid),
        first(`SELECT COUNT(*) AS n, AVG(r.duree) AS duree, AVG(r.duree_diagnostic) AS diag FROM rapport r JOIN machine m ON m.id = r.machine_id JOIN ligne l ON l.id = m.ligne_id
               JOIN atelier a ON a.id = l.atelier_id JOIN site s ON s.id = a.site_id WHERE s.projet_id = ? AND r.date >= date('now', ?)`, pid, since),
        all(`SELECT n.id, n.created_at, n.niveau_utile, n.motif, n.commentaire, n.statut_suivi, n.suivi_commentaire, n.traite_at, u.login AS traite_par, au.login AS auteur,
               (SELECT q.contenu FROM message q WHERE q.discussion_id = a.discussion_id AND q.role = 'user' AND q.rowid < a.rowid ORDER BY q.rowid DESC LIMIT 1) AS question,
               (SELECT group_concat(COALESCE(dd.titre, '?') || ' · v' || COALESCE(vv.numero, '?') ||
                  CASE WHEN c.page IS NOT NULL THEN ' · p. ' || c.page WHEN c.section IS NOT NULL AND c.section <> '—' THEN ' · § ' || c.section ELSE '' END, ' ; ')
                FROM citation c LEFT JOIN document_version vv ON vv.id = c.document_version_id LEFT JOIN document dd ON dd.id = vv.document_id WHERE c.message_id = a.id) AS sources
             FROM note n JOIN message a ON a.id = n.message_id JOIN discussion d ON d.id = n.discussion_id
             LEFT JOIN user u ON u.id = n.traite_par LEFT JOIN user au ON au.id = d.user_id
             WHERE d.projet_id = ? AND n.niveau_utile <> 'satisfaisante'
             ORDER BY CASE n.statut_suivi WHEN 'À analyser' THEN 0 ELSE 1 END, n.created_at DESC, n.rowid DESC LIMIT 100`, pid),
        first(`SELECT COUNT(*) AS n FROM note n JOIN discussion d ON d.id = n.discussion_id WHERE d.projet_id = ? AND n.statut_suivi = 'À analyser' AND n.niveau_utile <> 'satisfaisante'`, pid),
      ]);
      const by = (rows, k) => Object.fromEntries(rows.map((r) => [r.k, r.n]));
      const ev = by(notes, 'k'), E = { satisfaisante: ev.satisfaisante || 0, partielle: ev.partielle || 0, incorrecte: ev.incorrecte || 0 };
      E.total = E.satisfaisante + E.partielle + E.incorrecte;
      const q = by(quals, 'k'), Q = { brut: q.brut || 0, indexe: q.indexe || 0, valide: q.valide || 0 };
      Q.total = Q.brut + Q.indexe + Q.valide;
      const k = by(knows, 'k');
      const round = (x, p = 1) => (x == null ? null : Math.round(x * 10 ** p) / 10 ** p);
      return {
        periode_jours: days ? Number(days) : null,
        questions: qn.n, reponses: ans.n, sans_reponse: jsp.n,
        evaluations: E, taux_satisfaction: E.total ? round(E.satisfaisante / E.total * 100) : null, taux_evaluation: ans.n ? round(E.total / ans.n * 100) : null,
        motifs, sources_citees: top,
        qualification: { ...Q, taux_valide: Q.total ? round(Q.valide / Q.total * 100) : null },
        connaissances: { attente: k.attente || 0, validee: k.validee || 0, rejetee: k.rejetee || 0, corrigee: k.corrigee || 0 },
        interventions: { n: inter.n, duree_moyenne: round(inter.duree, 2), duree_diagnostic_moyenne: round(inter.diag, 2) },
        signalements_a_analyser: pending.n, signalements: signals,
      };
    },

    // ---------- données personnelles (RGPD) ----------
    async exportUser(uid) {
      const user = await first('SELECT id, login, email, is_active, last_login, created_at FROM user WHERE id = ?', uid);
      const projets = await all('SELECT p.id, p.nom, a.role FROM affecter a JOIN projet p ON p.id = a.projet_id WHERE a.user_id = ?', uid);
      const ds = await all('SELECT id, prompt, projet_id, created_at FROM discussion WHERE user_id = ? ORDER BY created_at', uid);
      const ids = JSON.stringify(ds.map((d) => d.id)), IN = '(SELECT value FROM json_each(?))';
      const messages = ds.length ? await all(`SELECT id, role, contenu, sans_reponse, created_at, discussion_id FROM message WHERE discussion_id IN ${IN} ORDER BY created_at, rowid`, ids) : [];
      const notes = ds.length ? await all(`SELECT niveau_utile, motif, commentaire, statut_suivi, created_at, message_id FROM note WHERE discussion_id IN ${IN}`, ids) : [];
      const journal = await all('SELECT created_at, categorie, action, element_type, detail, status, projet_id FROM log WHERE user_id = ? ORDER BY created_at DESC LIMIT 2000', uid);
      const rapports = await all('SELECT reference, date, probleme, diagnostic, actions, etat_final FROM rapport WHERE auteur_id = ? ORDER BY date', uid);
      return { user, projets, conversations: ds.map((d) => ({ ...d, messages: messages.filter((m) => m.discussion_id === d.id) })), evaluations: notes, interventions: rapports, journal };
    },
    /** Anonymise un compte : identité remplacée, connexion impossible, liens personnels (conversations, auteur des rapports, login saisi) coupés. */
    anonymiseUser: (uid, alias) => db.batch([
      q('UPDATE user SET login = ?, email = ?, password_hash = ?, is_active = 0 WHERE id = ?', alias, alias + '@supprime.invalid', 'anonymise', uid),
      q('UPDATE discussion SET user_id = NULL WHERE user_id = ?', uid),
      q('UPDATE rapport SET auteur_id = NULL WHERE auteur_id = ?', uid),
      q('UPDATE log SET login_saisi = NULL WHERE user_id = ?', uid)]),
    /** Conversations de plus de `days` jours, hors évaluations encore « À analyser ». */
    async purgeConversations(pid, days) {
      const where = `projet_id = ? AND created_at < datetime('now', ?) AND id NOT IN (SELECT discussion_id FROM note WHERE statut_suivi = 'À analyser')`;
      const n = (await first(`SELECT COUNT(*) AS n FROM discussion WHERE ${where}`, pid, `-${Number(days)} days`)).n;
      await run(`DELETE FROM discussion WHERE ${where}`, pid, `-${Number(days)} days`);
      return n;
    },
  };
}
