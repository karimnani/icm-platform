import { S } from '../../core/state.js';
import { val } from '../../core/format.js';
import { api } from '../../core/api.js';
import { mutate } from '../../core/remote.js';
import { sendToServer, ACCEPT } from '../ingestion-screen/upload.js';

let VERFILE = null;   // fichier choisi pour la nouvelle version (objet File : hors état affiché)
export { ACCEPT };

export const actions = {
  opendoc: ({ v }) => { S.docSel = v; S.docv = { tab: 'versions', upd: false, done: '' }; return location.hash === '#document'; },
  dtab: ({ v }) => { S.docv.tab = v; },
  updtoggle: () => { S.docv.upd = !S.docv.upd; S.docv.done = ''; VERFILE = null; S.docv.fname = ''; },
  updpub: ({ d, render }) => {
    const x = d.docs.find((y) => y.n === S.docSel) || d.docs[0]; if (!x) return;
    const chg = val('updc').trim() || 'Nouvelle version', file = VERFILE, pid = S.project;
    const done = (v) => { S.docv.upd = false; VERFILE = null; S.docv.fname = ''; S.docv.done = `v${v} publiée. L'IA relit le document et proposera les nouvelles connaissances dans la page Validation.`; };
    if (!file) { mutate(() => api.addVersion(pid, x.id, chg), render, { after: (r) => done(r.version) }); return false; }   // sans fichier : version enregistrée comme avant
    const ext = (n) => n.toLowerCase().split('.').pop();
    if (ext(file.name) !== ext(x.n)) { S.err = `Le nouveau fichier doit avoir le même format que le document (.${ext(x.n)}).`; return; }
    // avec fichier : le contenu est réellement relu, découpé et indexé sous la nouvelle version (le nom du document est conservé)
    mutate(() => sendToServer(file, { project: pid, version: String(x.v + 1), name: x.n, note: chg }).then(() => ({ version: x.v + 1 })), render, { after: (r) => done(r.version) });
    return false;
  },
  /** L'original n'est pas conservé sur le serveur (seul le contenu indexé l'est) : l'action l'explique au lieu de ne rien faire. */
  dl: () => { S.err = 'Téléchargement indisponible : le fichier d’origine n’est pas conservé sur le serveur (seul son contenu indexé l’est).'; },
  docedit: () => { S.docv.edit = !S.docv.edit; },
  docsave: ({ d, render }) => {
    const x = d.docs.find((y) => y.n === S.docSel); if (!x) return false;
    mutate(() => api.attachDocument(S.project, x.id, { type: val('dtp') || undefined, node_id: val('dnd') || undefined }), render, { after: () => { S.docv.edit = false; S.docv.done = 'Type et rattachement mis à jour.'; } });
    return false;
  },
  docdel: ({ d, render }) => {
    const x = d.docs.find((y) => y.n === S.docSel); if (!x) return false;
    if (typeof confirm === 'function' && !confirm(`Supprimer définitivement « ${x.n} » ? Sa fiche, son contenu indexé et ses connaissances associées seront effacés.`)) return false;
    mutate(() => api.deleteDocument(S.project, x.id), render, { after: () => { S.docSel = null; location.hash = '#documents'; } });
    return false;
  },
  /** Recherche sémantique dans le contenu indexé (moteur vectoriel), limitée au niveau d'arborescence choisi. */
  semsearch: ({ render }) => {
    const q = S.docs.q.trim(); if (!q) return;
    const sem = S.docs.sem = { q, loading: true, hits: [], err: '' };
    api.search(S.project, { q, node_id: S.docs.node === 'Tous' ? undefined : S.docs.node })
      .then((r) => { sem.hits = r.resultats || []; }).catch((e) => { sem.err = e.message; }).finally(() => { sem.loading = false; render(); });
  },
};


export const changes = {
  verfile: ({ t }) => { VERFILE = (t.files && t.files[0]) || null; S.docv.fname = VERFILE ? VERFILE.name : ''; },
  dtype: ({ v }) => { S.docs.type = v; },
  dnode: ({ v }) => { S.docs.node = v; },
};

export const inputs = {
  docq: ({ t }) => { S.docs.q = t.value; S.docs.sem = null; },
};
