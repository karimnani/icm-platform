import { json } from './responses.js';
import { ApplicationError } from '../../../application/errors.js';
import { classifyInfraError, refId } from '../../../application/services/resilience.js';
import { buildTree, subtreeIds, findNodeIn, ancestorIds, NODE_TYPES } from '../../../domain/tree.js';
import { clean, slug, documentHash } from '../../../domain/text/identifiers.js';
import { NO_ANSWER_MESSAGE } from '../../../domain/rag/answerPolicy.js';

const ROLES = ['Admin', 'Technicien'];
const STATUTS = ['validee', 'rejetee', 'corrigee'];
const NIVEAUX = ['satisfaisante', 'partielle', 'incorrecte'];
const MOTIFS = ['Information incomplète', 'Information erronée', 'Source non pertinente ou obsolète', 'Autre motif'];
const SUIVIS = ['À analyser', 'Corrigé', 'Sans suite'];
const PERIODES = { '7': 7, '30': 30, '90': 90, all: null };
export const RETENTION_MIN_DAYS = 30;
/** Politique de mot de passe : 10 caractères minimum, au moins une lettre et un chiffre. */
const passwordOk = (p) => String(p || '').length >= 10 && /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const bad = (m, s = 400) => new ApplicationError(m, s);
const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);

/**
 * API applicative /api/* (D1). Authentification par jeton signé (en-tête Authorization: Bearer …) ;
 * le rôle (Admin / Technicien) est celui de la table `affecter` pour le projet de la route.
 */
export function createApiHandler({ repo, crypto: cx, secret, askQuestion, searchPassages, deleteDocument }) {
  const routes = [];
  const on = (method, pattern, fn, { auth = true } = {}) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, auth });

  async function me(request) {
    const h = request.headers.get('Authorization') || '';
    const p = await cx.verifyToken(h.replace(/^Bearer\s+/i, ''), secret);
    if (!p) throw bad('Session expirée ou absente : reconnectez-vous.', 401);
    const u = await repo.userById(p.uid);
    if (!u || !u.is_active) throw bad('Compte désactivé ou introuvable.', 401);
    return u;
  }
  /** Trace un accès refusé dans le journal de cybersécurité (jamais bloquant ; ignoré si le projet n'existe pas). */
  async function denied(user, pid, detail) {
    try { if (await repo.projectExists(pid)) await repo.log({ categorie: 'securite', action: 'Accès refusé', detail, status: 'Échec', pid, uid: user.id }); }
    catch (e) { console.error('journal accès refusé :', e); }
  }
  async function need(user, pid, role) {
    const r = await repo.roleOf(user.id, pid);
    if (!r) { await denied(user, pid, 'Accès à un projet non affecté'); throw bad('Accès refusé à ce projet.', 403); }
    if (role && r !== role) { await denied(user, pid, `Action réservée aux administrateurs (rôle ${r})`); throw bad('Action réservée aux administrateurs du projet.', 403); }
    return r;
  }
  const session = async (u) => ({ user: { id: u.id, login: u.login, email: u.email }, projets: (await repo.projectsOf(u.id)).map((p) => ({ id: p.id, nom: p.nom, role: p.role, created_at: p.created_at })) });
  const body = (request) => request.json().catch(() => { throw bad('Corps JSON invalide.'); });
  const treeOf = async (pid) => buildTree(await repo.tree(pid));

  // ---- session ----
  on('POST', '/api/login', async ({ request }) => {
    const { email, password } = await body(request);
    const login = str(email, 200), u = login && await repo.userByLogin(login);
    const ok = u && u.is_active && await cx.verifyPassword(String(password || ''), u.password_hash);
    if (!ok) {
      await repo.log({ categorie: 'securite', action: 'Connexion', detail: 'Identifiants incorrects', status: 'Échec', loginSaisi: login, uid: u?.id, pid: u ? (await repo.projectsOf(u.id))[0]?.id : null });
      throw bad('Adresse e-mail ou mot de passe incorrect.', 401);
    }
    await repo.touchLogin(u.id);
    const s = await session(u);
    await repo.log({ categorie: 'securite', action: 'Connexion', detail: 'Connexion réussie', uid: u.id, pid: s.projets[0]?.id });
    return json({ ok: true, token: await cx.signToken({ uid: u.id }, secret), ...s });
  }, { auth: false });
  on('GET', '/api/me', async ({ user }) => json({ ok: true, ...(await session(user)) }));

  // ---- projets ----
  on('POST', '/api/projets', async ({ request, user }) => {
    const nom = str((await body(request)).nom, 120);
    if (!nom) throw bad('Nom du projet requis.');
    if (!(await repo.projectsOf(user.id)).some((p) => p.role === 'Admin')) throw bad('Seul un administrateur peut créer un projet.', 403);
    let id = clean(slug(nom)) || 'projet', n = 1;
    while (await repo.projectExists(id)) id = `${clean(slug(nom)) || 'projet'}-${++n}`;
    await repo.createProject(id, nom, user.id);
    await repo.log({ action: 'Projet', element: nom, detail: 'Projet créé', pid: id, uid: user.id });
    return json({ ok: true, projet: { id, nom, role: 'Admin' } }, 201);
  });

  on('GET', '/api/projets/:pid/bootstrap', async ({ user, params }) => {
    const role = await need(user, params.pid);
    const [tree, docs, know, decisions, reports, logs, users] = await Promise.all([
      treeOf(params.pid), repo.documents(params.pid), repo.knowledge(params.pid), repo.decisions(params.pid),
      repo.reports(params.pid), repo.logs(params.pid), role === 'Admin' ? repo.usersOf(params.pid) : [],
    ]);
    return json({ ok: true, role, tree, docs, know, decisions, reports, logs, users });
  });

  // ---- arborescence ----
  on('POST', '/api/projets/:pid/noeuds', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const b = await body(request), type = str(b.type), nom = str(b.nom, 160);
    if (!NODE_TYPES.includes(type)) throw bad('Type d’élément inconnu.');
    if (!nom) throw bad('Nom requis.');
    const tree = await treeOf(params.pid);
    const [, parentType] = type === 'Site' ? [] : repo.parentFieldOf(type);
    if (parentType) {
      const p = findNodeIn(tree, b.parent_id);
      if (!p || p.t !== parentType) throw bad(`Un élément « ${type} » se place sous un « ${parentType} » de ce projet.`, 422);
    }
    const id = crypto.randomUUID();
    await repo.addNode(type, { id, nom, parentId: b.parent_id, pid: params.pid });
    await repo.log({ action: 'Arborescence', element: nom, detail: type === 'Site' ? 'Site ajouté au projet' : `${type} ajouté`, pid: params.pid, uid: user.id });
    return json({ ok: true, id }, 201);
  });

  on('POST', '/api/projets/:pid/arborescence', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const { tree } = await body(request);
    if (!Array.isArray(tree)) throw bad('Arborescence attendue.');
    let count = 0;
    const walk = async (nodes, parentId, depth) => {
      for (const n of nodes) {
        const type = NODE_TYPES[depth];
        if (!type || n.t !== type) throw bad(`Niveau inattendu (« ${n.t} » au niveau ${depth + 1}).`, 422);
        const id = crypto.randomUUID();
        await repo.addNode(type, { id, nom: str(n.n, 160), parentId, pid: params.pid }); count++;
        await walk(n.kids || [], id, depth + 1);
      }
    };
    await walk(tree, null, 0);
    await repo.log({ action: 'Arborescence', element: 'nomenclature_equipements.xlsx', detail: `Arborescence importée (${count} éléments)`, pid: params.pid, uid: user.id });
    return json({ ok: true, count }, 201);
  });

  const ownNode = async (pid, id) => { const n = findNodeIn(await treeOf(pid), id); if (!n) throw bad('Élément introuvable dans ce projet.', 404); return n; };
  on('PATCH', '/api/projets/:pid/noeuds/:id', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const nom = str((await body(request)).nom, 160), n = await ownNode(params.pid, params.id);
    if (!nom) throw bad('Nom requis.');
    await repo.renameNode(n.t, n.id, nom);
    await repo.log({ action: 'Arborescence', element: nom, detail: `Renommé (ancien nom : ${n.n})`, pid: params.pid, uid: user.id });
    return json({ ok: true });
  });
  on('DELETE', '/api/projets/:pid/noeuds/:id', async ({ user, params }) => {
    await need(user, params.pid, 'Admin');
    const n = await ownNode(params.pid, params.id);
    const used = await repo.attachedCount(subtreeIds(await treeOf(params.pid), n.id));
    if (used.documents || used.rapports) throw bad(`Impossible de supprimer : ${used.documents} document(s) et ${used.rapports} intervention(s) sont rattachés à cet élément ou en dessous.`, 409);
    await repo.deleteNode(n.t, n.id);
    await repo.log({ action: 'Arborescence', element: n.n, detail: 'Élément supprimé', pid: params.pid, uid: user.id });
    return json({ ok: true });
  });

  // ---- interventions ----
  on('POST', '/api/projets/:pid/interventions', async ({ request, user, params }) => {
    await need(user, params.pid);
    const b = await body(request), m = findNodeIn(await treeOf(params.pid), b.machine_id);
    if (!m || m.t !== 'Machine') throw bad('Choisissez une machine de ce projet.', 422);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
    const r = { id: crypto.randomUUID(), date, machine_id: m.id, auteur_id: user.id, probleme: str(b.probleme), diagnostic: str(b.diagnostic), actions: str(b.actions),
      etat_final: str(b.etat_final, 200), pieces: str(b.pieces) || null, duree: Number.isFinite(Number(b.duree)) ? Number(b.duree) : null };
    if (!r.date || !r.probleme || !r.diagnostic || !r.actions || !r.etat_final) throw bad('Date, problème, diagnostic, travaux et état final sont requis.', 422);
    for (let i = 0; ; i++) {   // la référence est UNIQUE : on retente si deux saisies simultanées la choisissent
      r.reference = await repo.nextReference();
      try { await repo.addReport(r); break; } catch (e) { if (i >= 2 || !/UNIQUE/i.test(String(e.message))) throw e; }
    }
    await repo.log({ action: 'Intervention', element: `${r.reference} ${m.n}`, elementId: r.id, detail: 'Intégrée à la base', pid: params.pid, uid: user.id });
    return json({ ok: true, reference: r.reference, id: r.id }, 201);
  });

  // ---- validation des connaissances ----
  on('POST', '/api/projets/:pid/connaissances/:cid/decision', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const b = await body(request), k = await repo.knowledgeOf(params.cid);
    if (!k || k.projet_id !== params.pid) throw bad('Connaissance introuvable dans ce projet.', 404);
    if (!STATUTS.includes(b.statut)) throw bad('Statut inconnu.');
    if (b.statut === 'rejetee' && !str(b.motif, 500)) throw bad('Un motif est obligatoire pour rejeter une connaissance (décision auditable).', 422);
    const c = b.corrections, fields = b.statut === 'corrigee' && c
      ? { sujet: str(c.sujet, 300) || k.sujet, relation: str(c.relation, 300) || k.relation, objet: str(c.objet, 300) || k.objet, texte_valide: str(c.texte_valide) } : null;
    await repo.decide({ cid: k.id, ancien: k.statut, nouveau: b.statut, motif: str(b.motif, 500), uid: user.id, fields, documentId: k.document_id });
    const lbl = { validee: 'validée', rejetee: 'rejetée', corrigee: 'corrigée puis validée' }[b.statut];
    await repo.log({ action: { validee: 'Validation', rejetee: 'Rejet', corrigee: 'Correction' }[b.statut], element: k.doc, elementId: k.id,
      detail: `Connaissance « ${fields?.sujet || k.sujet} ${fields?.relation || k.relation} ${fields?.objet || k.objet} » ${lbl}${b.statut === 'rejetee' ? ' — motif : ' + str(b.motif, 500) : ''}`, pid: params.pid, uid: user.id });
    return json({ ok: true });
  });

  // ---- documents ----
  on('POST', '/api/projets/:pid/documents/:did/versions', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const d = await repo.documentOf(params.did);
    if (!d || d.projet_id !== params.pid) throw bad('Document introuvable dans ce projet.', 404);
    const note = str((await body(request)).note, 500) || 'Nouvelle version', n = await repo.addVersion(d.id, note);
    await repo.log({ action: 'Nouvelle version', element: d.titre, elementId: d.id, detail: `v${n - 1} → v${n} : ${note}`, pid: params.pid, uid: user.id });
    return json({ ok: true, version: n }, 201);
  });

  on('PATCH', '/api/projets/:pid/documents/:did', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const d = await repo.documentOf(params.did), b = await body(request);
    if (!d || d.projet_id !== params.pid) throw bad('Document introuvable dans ce projet.', 404);
    const t = b.type ? await repo.typeByName(str(b.type, 200)) : null;
    if (b.type && !t) throw bad('Type de document inconnu.', 422);
    const n = b.node_id ? findNodeIn(await treeOf(params.pid), b.node_id) : null;
    if (b.node_id && !n) throw bad('Élément d’arborescence introuvable dans ce projet.', 422);
    await repo.attachDocument(d.id, t?.id || null, n?.t || null, n?.id || null);
    await repo.log({ action: 'Rattachement', element: d.titre, elementId: d.id, detail: `${b.type ? 'Type ' + b.type + ' · ' : ''}${n ? 'rattaché à ' + n.n : 'non rattaché'}`, pid: params.pid, uid: user.id });
    return json({ ok: true });
  });

  // ---- comptes ----
  on('POST', '/api/projets/:pid/users', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const b = await body(request), email = str(b.email, 200).toLowerCase(), role = str(b.role);
    if (!EMAIL.test(email)) throw bad('Adresse e-mail invalide.');
    if (!ROLES.includes(role)) throw bad('Rôle inconnu.');
    const ex = await repo.userByLogin(email);
    let temp = null;
    if (ex) await repo.assign(ex.id, params.pid, role);
    else { temp = cx.randomPassword(); await repo.createUser({ id: crypto.randomUUID(), login: email.split('@')[0], email, hash: await cx.hashPassword(temp), pid: params.pid, role }); }
    await repo.log({ action: 'Compte', element: email, detail: `Compte ${ex ? 'rattaché' : 'créé'} (${role})`, pid: params.pid, uid: user.id });
    return json({ ok: true, motDePasseTemporaire: temp }, 201);
  });
  on('PATCH', '/api/projets/:pid/users/:uid', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const b = await body(request), target = await repo.userById(params.uid), tr = target && await repo.roleOf(target.id, params.pid);
    if (!tr) throw bad('Compte introuvable dans ce projet.', 404);
    if (b.is_active === false && target.id === user.id) throw bad('Vous ne pouvez pas désactiver votre propre compte : demandez à un autre administrateur.', 409);
    const demote = (b.role && b.role !== 'Admin' && tr === 'Admin') || b.is_active === false;
    if (demote && tr === 'Admin' && await repo.adminCount(params.pid) <= 1) throw bad('Impossible : c’est le dernier administrateur actif du projet.', 409);
    if (b.role !== undefined) { if (!ROLES.includes(b.role)) throw bad('Rôle inconnu.'); await repo.assign(target.id, params.pid, b.role); }
    if (b.is_active !== undefined) await repo.setActive(target.id, !!b.is_active);
    await repo.log({ action: 'Compte', element: target.email, detail: b.role !== undefined ? `Rôle → ${b.role}` : (b.is_active ? 'Compte réactivé' : 'Compte désactivé'), pid: params.pid, uid: user.id });
    return json({ ok: true });
  });

  // ---- périmètre de recherche : documents rattachés à l'équipement choisi, à ses ancêtres (site, atelier, ligne) ou à ses descendants, + non rattachés ----
  async function scopeOf(pid, nodeId) {
    if (!nodeId) return undefined;
    const tree = await treeOf(pid), n = findNodeIn(tree, nodeId);
    if (!n) throw bad('Élément d’arborescence introuvable dans ce projet.', 422);
    return repo.scopeDocIds(pid, [...ancestorIds(tree, n.id), ...subtreeIds(tree, n.id)]);
  }

  // ---- assistant : réponse + conversation enregistrée (discussion / message / citation) ----
  on('POST', '/api/projets/:pid/chat', async ({ request, user, params }) => {
    await need(user, params.pid);
    if (!askQuestion) throw bad('Moteur de réponse non branché sur ce Worker.', 503);
    const b = await body(request), question = str(b.question, 1000);
    if (!question) throw bad('Posez une question.');
    const allowedDocIds = await scopeOf(params.pid, str(b.node_id, 80));
    let out;
    try { out = await askQuestion({ question, project: params.pid, allowedDocIds }); }
    catch (e) { console.error(e); throw bad('Le moteur de réponse est indisponible : ' + e.message, 502); }
    const ids = { discussion_id: null, message_id: null };
    try {   // l'enregistrement ne doit jamais faire perdre la réponse : en cas d'échec, la réponse part quand même (sans identifiants)
      let did = str(b.discussion_id, 80);
      const disc = did && await repo.discussionOf(did);
      if (!disc || disc.user_id !== user.id || disc.projet_id !== params.pid) { did = crypto.randomUUID(); await repo.createDiscussion({ id: did, prompt: question.slice(0, 120), uid: user.id, pid: params.pid }); }
      const mid = crypto.randomUUID();
      await repo.addMessage({ id: crypto.randomUUID(), role: 'user', contenu: question, did });
      await repo.addMessage({ id: mid, role: 'assistant', contenu: out.response, sansReponse: /^je ne sais pas/i.test(out.response) || out.response === NO_ANSWER_MESSAGE, did });
      for (const s of out.sources || []) {
        const docId = await documentHash(params.pid, s[0]);
        await repo.addCitation({ id: crypto.randomUUID(), page: s[4], section: s[2] === '—' ? null : s[2], extrait: s[3], mid, versionId: await repo.versionIdOf(docId, s[1]) });
      }
      ids.discussion_id = did; ids.message_id = mid;
    } catch (e) { console.error('conversation non enregistrée :', e); }
    return json({ ok: true, response: out.response, sources: out.sources, ...ids });
  });

  on('GET', '/api/projets/:pid/discussions', async ({ user, params }) => {
    await need(user, params.pid);
    return json({ ok: true, discussions: await repo.discussionsOf(params.pid, user.id) });
  });

  on('POST', '/api/projets/:pid/messages/:mid/note', async ({ request, user, params }) => {
    await need(user, params.pid);
    const m = await repo.messageOf(params.mid);
    if (!m || m.projet_id !== params.pid || m.user_id !== user.id || m.role !== 'assistant') throw bad('Réponse introuvable.', 404);
    const b = await body(request), niveau = str(b.niveau, 30), motif = str(b.motif, 200), commentaire = str(b.commentaire, 1000);
    if (!NIVEAUX.includes(niveau)) throw bad('Niveau d’utilité inconnu.');
    if (niveau !== 'satisfaisante' && !MOTIFS.includes(motif)) throw bad('Précisez le motif de l’insatisfaction.', 422);
    if (await repo.noteOfMessage(m.id)) throw bad('Cette réponse a déjà été évaluée.', 409);
    await repo.addNote({ id: crypto.randomUUID(), niveau, motif: niveau === 'satisfaisante' ? null : motif, commentaire: commentaire || null, did: m.discussion_id, mid: m.id });
    await repo.log({ categorie: 'usage', action: 'Évaluation', element: 'Réponse de l’assistant', elementId: m.id, detail: `Réponse jugée « ${niveau} »${niveau === 'satisfaisante' ? '' : ' — ' + motif}`, pid: params.pid, uid: user.id });
    return json({ ok: true }, 201);
  });

  // ---- recherche sémantique dans le contenu indexé ----
  on('POST', '/api/projets/:pid/recherche', async ({ request, user, params }) => {
    await need(user, params.pid);
    if (!searchPassages) throw bad('Recherche sémantique non branchée sur ce Worker.', 503);
    const b = await body(request), query = str(b.q, 300);
    if (!query) throw bad('Saisissez une recherche.');
    const allowedDocIds = await scopeOf(params.pid, str(b.node_id, 80));
    try { return json({ ok: true, resultats: await searchPassages({ query, project: params.pid, allowedDocIds }) }); }
    catch (e) { console.error(e); throw bad('La recherche sémantique est indisponible : ' + e.message, 502); }
  });

  // ---- pilotage : indicateurs et file des réponses signalées (administrateur) ----
  on('GET', '/api/projets/:pid/indicateurs', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    let per = new URL(request.url).searchParams.get('per') || '30'; if (!(per in PERIODES)) per = '30';
    return json({ ok: true, ...(await repo.indicators(params.pid, PERIODES[per])), per });
  });
  on('PATCH', '/api/projets/:pid/notes/:nid', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const n = await repo.noteOf(params.nid);
    if (!n || n.projet_id !== params.pid) throw bad('Signalement introuvable dans ce projet.', 404);
    const b = await body(request), statut = str(b.statut, 30), commentaire = str(b.commentaire, 500);
    if (!SUIVIS.includes(statut)) throw bad('Statut de suivi inconnu.');
    if (statut === 'Corrigé' && !commentaire) throw bad('Indiquez ce qui a été corrigé (source mise à jour, connaissance validée…).', 422);
    await repo.setNoteFollowUp({ nid: n.id, statut, commentaire, uid: user.id });
    await repo.log({ action: 'Signalement', element: 'Réponse signalée', elementId: n.id, detail: `${n.statut_suivi} → ${statut}${commentaire ? ' : ' + commentaire : ''}`, pid: params.pid, uid: user.id });
    return json({ ok: true });
  });

  // ---- gestion documentaire : suppression d'un document (fiche + vecteurs + connaissances associées) ----
  on('DELETE', '/api/projets/:pid/documents/:did', async ({ user, params }) => {
    await need(user, params.pid, 'Admin');
    const d = await repo.documentOf(params.did);
    if (!d || d.projet_id !== params.pid) throw bad('Document introuvable dans ce projet.', 404);
    const nk = await repo.knowledgeCountOfDocument(d.id);
    if (deleteDocument) await deleteDocument({ project: params.pid, docName: d.titre });   // vecteurs + fiche du catalogue
    await repo.deleteDocument(d.id, params.pid);
    await repo.log({ action: 'Suppression', element: d.titre, elementId: d.id, detail: `Document supprimé${nk ? ` avec ${nk} connaissance(s) associée(s)` : ''}`, pid: params.pid, uid: user.id });
    return json({ ok: true, connaissances: nk });
  });

  // ---- compte connecté : mot de passe, export des données (RGPD) ----
  on('POST', '/api/me/password', async ({ request, user }) => {
    const b = await body(request), full = await repo.userFull(user.id), first = (await repo.projectsOf(user.id))[0];
    if (!(await cx.verifyPassword(String(b.ancien || ''), full.password_hash))) {
      await repo.log({ categorie: 'securite', action: 'Changement de mot de passe', detail: 'Mot de passe actuel incorrect', status: 'Échec', pid: first?.id, uid: user.id });
      throw bad('Mot de passe actuel incorrect.', 403);
    }
    if (!passwordOk(b.nouveau)) throw bad('Le nouveau mot de passe doit contenir au moins 10 caractères, dont au moins une lettre et un chiffre.', 422);
    if (b.nouveau === b.ancien) throw bad('Le nouveau mot de passe doit être différent de l’actuel.', 422);
    await repo.setPassword(user.id, await cx.hashPassword(String(b.nouveau)));
    await repo.log({ categorie: 'securite', action: 'Changement de mot de passe', detail: 'Mot de passe modifié', pid: first?.id, uid: user.id });
    return json({ ok: true });
  });
  on('GET', '/api/me/export', async ({ user }) => {
    const first = (await repo.projectsOf(user.id))[0];
    await repo.log({ categorie: 'securite', action: 'Export des données personnelles', detail: 'Export demandé par l’utilisateur', pid: first?.id, uid: user.id });
    return json({ ok: true, genere_le: new Date().toISOString(), donnees: await repo.exportUser(user.id) });
  });

  // ---- RGPD (administrateur) : anonymisation d'un compte désactivé, durée de conservation des conversations ----
  on('POST', '/api/projets/:pid/users/:uid/anonymiser', async ({ user, params }) => {
    await need(user, params.pid, 'Admin');
    const target = await repo.userById(params.uid);
    if (!target || !(await repo.roleOf(target.id, params.pid))) throw bad('Compte introuvable dans ce projet.', 404);
    if (target.id === user.id) throw bad('Vous ne pouvez pas anonymiser votre propre compte.', 409);
    if (target.is_active) throw bad('Désactivez d’abord le compte : seul un compte désactivé peut être anonymisé.', 409);
    if ((await repo.projectsOf(target.id)).length > 1) throw bad('Ce compte est rattaché à d’autres projets : l’anonymisation y supprimerait aussi son accès. Retirez-le d’abord de ces projets.', 409);
    const alias = 'anonyme-' + target.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
    await repo.anonymiseUser(target.id, alias);
    await repo.log({ categorie: 'securite', action: 'Anonymisation (RGPD)', element: alias, detail: 'Compte anonymisé : identité effacée, conversations et comptes rendus détachés', pid: params.pid, uid: user.id });
    return json({ ok: true, alias });
  });
  on('POST', '/api/projets/:pid/conversations/purge', async ({ request, user, params }) => {
    await need(user, params.pid, 'Admin');
    const jours = Number((await body(request)).jours);
    if (!Number.isInteger(jours) || jours < RETENTION_MIN_DAYS) throw bad(`Durée de conservation minimale : ${RETENTION_MIN_DAYS} jours.`, 422);
    const n = await repo.purgeConversations(params.pid, jours);
    await repo.log({ categorie: 'securite', action: 'Purge des conversations (RGPD)', detail: `${n} conversation(s) de plus de ${jours} jours supprimée(s) (évaluations « À analyser » conservées)`, pid: params.pid, uid: user.id });
    return json({ ok: true, supprimees: n });
  });

  return async function handle(request) {
    try {
      if (!secret) throw bad('AUTH_SECRET non défini sur le Worker (npx wrangler secret put AUTH_SECRET).', 503);
      const { pathname } = new URL(request.url);
      for (const r of routes) {
        const m = r.method === request.method && pathname.match(r.re);
        if (!m) continue;
        const user = r.auth ? await me(request) : null;
        return await r.fn({ request, user, params: m.groups || {} });
      }
      return json({ ok: false, error: 'Route API inconnue.' }, 404);
    } catch (e) {
      if (e instanceof ApplicationError) return json({ ok: false, error: e.message }, e.status);
      const ref = refId(), c = classifyInfraError(e);
      console.error('[' + ref + ']', e);
      return json({ ok: false, error: c.message, ref }, c.status);
    }
  };
}
