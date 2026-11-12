import { S } from '../../core/state.js';
import { val } from '../../core/format.js';
import { api } from '../../core/api.js';
import { download } from '../../core/download.js';

export const submits = {
  pwchange: ({ render }) => {
    const o = val('pwo'), n = val('pwn'), c = val('pwc');
    S.compte.msg = ''; S.compte.err = '';
    if (!o || !n) { S.compte.err = 'Renseignez le mot de passe actuel et le nouveau.'; return; }
    if (n !== c) { S.compte.err = 'La confirmation ne correspond pas au nouveau mot de passe.'; return; }
    api.changePassword(o, n).then(() => { S.compte.msg = 'Mot de passe modifié.'; }).catch((e) => { S.compte.err = e.message; }).finally(render);
    return false;
  },
};

export const actions = {
  exportme: ({ render }) => {
    S.compte.msg = ''; S.compte.err = '';
    api.exportMine().then((r) => { download('mes-donnees-icm.json', JSON.stringify(r, null, 2), 'application/json;charset=utf-8'); S.compte.msg = 'Export téléchargé.'; })
      .catch((e) => { S.compte.err = e.message; }).finally(render);
    return false;
  },
};
