import { S } from '../../core/state.js';
import { val } from '../../core/format.js';
import { api } from '../../core/api.js';
import { logout } from '../../core/remote.js';

/** Charge les indicateurs à l'affichage de l'écran (une seule fois par projet et période ; « Actualiser » force le rechargement). */
export function loadIndicators(render) {
  const pid = S.project, per = S.ind.per, key = pid + '|' + per;
  if (S.ind.key === key || S.ind.loading) return;
  S.ind.loading = true;
  api.indicators(pid, per)
    .then((r) => { if (S.project === pid && S.ind.per === per) { S.ind.data = r; S.ind.err = ''; } })
    .catch((e) => { S.ind.err = e.message; if (e.status === 401) { logout(); location.hash = '#connexion'; S.loginErr = e.message; } })
    .finally(() => { S.ind.loading = false; if (S.project === pid && S.ind.per === per) S.ind.key = key; render(); });
}

export const actions = {
  indrefresh: () => { S.ind.key = ''; },
  indtreat: ({ v }) => { S.ind.treat = S.ind.treat === v ? null : v; S.ind.treatErr = ''; },
  indset: ({ v, render }) => {
    const id = S.ind.treat; if (!id) return false;
    api.followUp(S.project, id, { statut: v, commentaire: val('indc').trim() })
      .then(() => { S.ind.treat = null; S.ind.treatErr = ''; S.ind.key = ''; })
      .catch((e) => { S.ind.treatErr = e.message; })
      .finally(render);
    return false;
  },
};

export const changes = {
  iper: ({ v }) => { S.ind.per = v; S.ind.key = ''; },
  indfilter: ({ v }) => { S.ind.filter = v; },
};
