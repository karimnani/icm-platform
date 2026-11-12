import { D } from './projectData.js';
import { S } from './state.js';

export function switchProject(id) {
  S.project = id; const d = D();
  S.docs = { q: '', type: 'Tous', node: 'Tous', sem: null }; S.docSel = d.docs[0] ? d.docs[0].n : null; S.docv = { tab: 'versions', upd: false, done: '', edit: false, fname: '' };
  S.cr.ai = null; S.cr.saved = ''; S.cr.f.m = ''; S.val.editing = false; S.val.rejecting = false; S.val.err = ''; S.ind.key = ''; S.ind.data = null; S.ind.treat = null; S.chat.node = ''; S.importMsg = ''; S.treeMsg = ''; S.up.saved = false; S.chat.draft = '';
  S.hist = { tab: 'mv', q: '', type: 'Tous', user: 'Tous', luser: 'Tous', per: '7' };
}
