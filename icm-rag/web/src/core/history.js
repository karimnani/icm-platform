import { D } from './projectData.js';
import { S } from './state.js';
import { TODAY } from './format.js';

export const hist = (type, el, det, by) => D().hist.unshift([TODAY + ' ' + new Date().toTimeString().slice(0, 5), type, el, det, by || (S.role === 'admin' ? 'admin' : 'p.durand'), S.role === 'admin' ? 'Admin' : 'Technicien']);
