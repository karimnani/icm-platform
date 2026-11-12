import { S } from '../../core/state.js';
import { analyse } from './view.js';
import { pathOf } from '../../core/tree.js';
import { api } from '../../core/api.js';
import { mutate } from '../../core/remote.js';

const BLANK = () => ({ m: '', d: '2026-10-16', pb: '', diag: '', trav: '', h: '', etat: '', pieces: '' });

export const actions = {
  crtab: ({ v }) => { S.cr.tab = v; S.cr.ai = null; S.cr.saved = ''; },
  crsave: ({ render }) => {
    const f = { ...S.cr.f }, duree = parseFloat(String(f.h).replace(',', '.'));
    mutate(() => api.createIntervention(S.project, { machine_id: f.m, date: f.d, probleme: f.pb, diagnostic: f.diag, actions: f.trav, etat_final: f.etat, pieces: f.pieces, duree: Number.isFinite(duree) ? duree : null }), render, {
      after: (r) => { S.cr.saved = `${r.reference} enregistré : rattaché à ${pathOf(f.m)} et intégré à la base (type « Rapports d'intervention / Relevés de mesures »).`; S.cr.ai = null; S.cr.f = BLANK(); },
    });
    return false;
  },
};

export const submits = {
  crsubmit: () => { S.cr.ai = analyse(S.cr.f); S.cr.saved = ''; },
};
