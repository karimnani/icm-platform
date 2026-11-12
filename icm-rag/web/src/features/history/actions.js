import { S } from '../../core/state.js';
import { D } from '../../core/projectData.js';
import { download, toCsv } from '../../core/download.js';
import { filteredLogs } from './view.js';

export const actions = {
  htab: ({ v }) => { S.hist.tab = v; },
  exportlogs: () => {   // export des lignes actuellement filtrées
    const rows = filteredLogs(D(), S.hist);
    download(`journal-${S.project}.csv`, toCsv([['Date et heure', 'Utilisateur', 'Action', 'Détail', 'Statut'], ...rows.map((l) => [l[0], l[2], l[3], l[4], l[5]])]), 'text/csv;charset=utf-8');
    return false;
  },
};

export const changes = {
  histtype: ({ v }) => { S.hist.type = v; },
  histuser: ({ v }) => { S.hist.user = v; },
  logper: ({ v }) => { S.hist.per = v; },
  loguser: ({ v }) => { S.hist.luser = v; },
};

export const inputs = {
  histq: ({ t }) => { S.hist.q = t.value; },
};
