import { S } from '../../core/state.js';
import { hist } from '../../core/history.js';
import { pathOf } from '../../core/tree.js';
import { api } from '../../core/api.js';
import { mutate } from '../../core/remote.js';
import { addFiles, retry, forget } from './uploader.js';

export const actions = {
  upretry: ({ v, d, render }) => { retry(v, d, render); return false; },
  upremove: ({ v, d }) => { d.files = d.files.filter((f) => f.n !== v); delete d.fmeta[v]; forget(v); if (d.upSel === v) d.upSel = d.files[0] ? d.files[0].n : null; },
  upsave: ({ d, render }) => {
    const m = d.fmeta[d.upSel], doc = d.docs.find((x) => x.n === d.upSel);
    if (!doc && d.files.find((f) => f.n === d.upSel && f.real)) return;   // fichier réel pas encore indexé : rien à rattacher
    if (!doc) { S.up.saved = true; hist('Rattachement', d.upSel, 'Type ' + m[0] + ' · rattaché à ' + pathOf(m[1])); return; }   // fichier simulé : pas encore indexé
    mutate(() => api.attachDocument(S.project, doc.id, { type: m[0] || undefined, node_id: m[1] || undefined }), render, { after: () => { S.up.saved = true; } });
    return false;
  },
};

export const changes = {
  upfiles: ({ t, d, render }) => { const list = Array.from(t.files || []); t.value = ''; if (list.length) addFiles(list, d, render); return false; },
  upfile: ({ v, d }) => { d.upSel = v; S.up.saved = false; },
  uptype: ({ v, d }) => { d.fmeta[d.upSel][0] = v; S.up.saved = false; },
  upnode: ({ v, d }) => { d.fmeta[d.upSel][1] = v; S.up.saved = false; },
};
