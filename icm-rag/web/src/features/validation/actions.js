import { D } from '../../core/projectData.js';
import { S } from '../../core/state.js';
import { val } from '../../core/format.js';
import { api } from '../../core/api.js';
import { mutate } from '../../core/remote.js';

/** Décision d'un administrateur sur la connaissance sélectionnée : enregistrée dans D1 (connaissance + decision + journal). */
export function decide(st, upd, render, motif) {
  const d = D(), it = d.val.find((i) => i.id === d.valSel); if (!it) return;
  const corrections = upd && { sujet: upd.a, relation: upd.r, objet: upd.b, texte_valide: upd.know };
  mutate(() => api.decide(S.project, it.rid, { statut: st, corrections, ...(motif ? { motif } : {}) }), render, { after: () => { S.val.editing = false; S.val.rejecting = false; S.val.err = ''; } });
}

export const actions = {
  pick: ({ v, d }) => { d.valSel = Number(v); S.val.editing = false; S.val.rejecting = false; S.val.err = ''; },
  valmore: () => { S.val.n += 25; },
  edit: () => { S.val.editing = true; },
  canceledit: () => { S.val.editing = false; },
  saveedit: ({ render }) => { decide('corrigee', { a: val('ea'), r: val('er'), b: val('eb'), know: val('ek') }, render); return false; },
  // Le rejet exige un motif (décision auditable) : « Rejeter » ouvre d'abord la saisie du motif.
  decide: ({ v, render }) => { if (v === 'rejetee') { S.val.rejecting = true; S.val.err = ''; return; } decide(v, undefined, render); return false; },
  rejcancel: () => { S.val.rejecting = false; S.val.err = ''; },
  rejconfirm: ({ render }) => { const m = val('rm').trim(); if (!m) { S.val.err = 'Indiquez le motif du rejet.'; return; } decide('rejetee', undefined, render, m); return false; },
};

export const changes = {
  valf: ({ v }) => { S.val.f = v; S.val.n = 25; },
};

export const inputs = {
  valq: ({ t }) => { S.val.q = t.value; S.val.n = 25; },
};
