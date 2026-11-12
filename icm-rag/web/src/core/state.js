export const S = {
  role: null, project: 'lyon', recovered: false,
  projects: [{ id: 'lyon', n: 'Usine de Lyon', date: '01/09/2026' }, { id: 'grenoble', n: 'Usine de Grenoble', date: '10/10/2026' }],
  projForm: false, projErr: false, tplPick: 'standard', importMsg: '', treeMsg: '',
  docs: { q: '', type: 'Tous', node: 'Tous', sem: null }, docSel: null, docv: { tab: 'versions', upd: false, done: '', edit: false, fname: '' }, busy: false,
  chat: { draft: '', showWhy: false, node: '' },
  cr: { tab: 'new', f: { m: '', d: '2026-10-16', pb: '', diag: '', trav: '', h: '', etat: '', pieces: '' }, ai: null, saved: '' },
  up: { saved: false },
  val: { editing: false, rejecting: false, err: '', f: 'all', q: '', n: 25 },
  ind: { per: '30', data: null, key: '', loading: false, err: '', filter: 'a', treat: null, treatErr: '' },
  compte: { msg: '', err: '' },
  hist: { tab: 'mv', q: '', type: 'Tous', user: 'Tous', luser: 'Tous', per: '7' },
  acc: { form: false, err: false, msg: '', rgpd: '', users: [
    { id: 1, m: 'admin@usine-lyon.fr', r: 'Admin', p: 'Usine de Lyon', l: "Aujourd'hui 14:58", a: true },
    { id: 2, m: 'j.martin@usine-lyon.fr', r: 'Technicien', p: 'Usine de Lyon', l: 'Hier 09:02', a: true },
    { id: 3, m: 'p.durand@usine-lyon.fr', r: 'Technicien', p: 'Usine de Lyon', l: "Aujourd'hui 14:29", a: true },
    { id: 4, m: 's.leroy@usine-lyon.fr', r: 'Technicien', p: 'Usine de Lyon', l: '09/10/2026', a: true },
    { id: 5, m: 'm.petit@usine-lyon.fr', r: 'Technicien', p: 'Usine de Lyon', l: '12/08/2026', a: false },
    { id: 6, m: 'admin@usine-grenoble.fr', r: 'Admin', p: 'Usine de Grenoble', l: '13/10/2026', a: true },
    { id: 7, m: 'l.bernard@usine-grenoble.fr', r: 'Technicien', p: 'Usine de Grenoble', l: "Aujourd'hui 08:12", a: true },
    { id: 8, m: 'c.roux@usine-grenoble.fr', r: 'Technicien', p: 'Usine de Grenoble', l: '10/10/2026', a: true }
  ] },
  gmao: { ok: false, saved: false, msg: '', cfg: { name: '', url: '', freq: 'Chaque nuit' }, opts: [true, false], map: [['code_equipement', 'Machine'], ['libelle_equipement', 'Nom de la machine'], ['num_ordre_travail', 'Référence intervention'], ['type_intervention', 'Type de document'], ['date_fin', 'Date'], ['compte_rendu', 'Document lié']] }
};
export const projName = () => (S.projects.find((p) => p.id === S.project) || S.projects[0]).n;
