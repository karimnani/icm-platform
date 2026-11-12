import { S } from '../../core/state.js';
import { val } from '../../core/format.js';
import { api } from '../../core/api.js';
import { mutate } from '../../core/remote.js';

export const actions = {
  accform: () => { S.acc.form = !S.acc.form; S.acc.err = false; S.acc.msg = ''; },
  toggleuser: ({ v, render }) => { const u = S.acc.users.find((x) => x.id === v); if (u) mutate(() => api.patchUser(S.project, u.id, { is_active: !u.a }), render); return false; },
  /** RGPD : anonymiser un compte désactivé (identité effacée, conversations et comptes rendus détachés). */
  anonymise: ({ v, render }) => {
    const u = S.acc.users.find((x) => x.id === v); if (!u) return false;
    if (typeof confirm === 'function' && !confirm(`Anonymiser définitivement ${u.m} ? L'identité sera effacée et cette action est irréversible.`)) return false;
    mutate(() => api.anonymiseUser(S.project, u.id), render, { after: (r) => { S.acc.msg = `Compte anonymisé (${r.alias}).`; } });
    return false;
  },
  purgeconv: ({ render }) => {
    const jours = Number(val('retj'));
    if (!Number.isInteger(jours) || jours < 30) { S.acc.rgpd = 'Durée minimale : 30 jours.'; return; }
    if (typeof confirm === 'function' && !confirm(`Supprimer les conversations de plus de ${jours} jours ? Les évaluations encore « À analyser » sont conservées.`)) return false;
    S.acc.rgpd = '';
    mutate(() => api.purgeConversations(S.project, jours), render, { after: (r) => { S.acc.msg = `${r.supprimees} conversation(s) supprimée(s).`; } });
    return false;
  },
};

export const submits = {
  acccreate: ({ render }) => {
    const m = val('am').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) { S.acc.err = true; return; }
    const proj = S.projects.find((p) => p.n === val('ap')) || { id: S.project };
    mutate(() => api.createUser(proj.id, m, val('ar')), render, {
      after: (r) => { S.acc.form = false; S.acc.err = false; S.acc.msg = r.motDePasseTemporaire ? `Compte créé pour ${m}. Mot de passe temporaire (affiché une seule fois, à transmettre à la personne) : ${r.motDePasseTemporaire}` : `${m} existait déjà : il a simplement été rattaché au projet.`; },
    });
    return false;
  },
};

export const changes = {
  role: ({ t, v, render }) => { mutate(() => api.patchUser(S.project, t.dataset.id, { role: v }), render); return false; },
};
