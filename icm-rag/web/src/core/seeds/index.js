import { grenoble } from './grenoble.js';
import { lyon } from './lyon.js';

export const SEEDS = { lyon, grenoble };
export const EMPTY = () => ({ tpl: 'standard', tree: [], docs: [], qa: [], sugg: [], convQs: [], crs: [], files: [], fmeta: {}, val: [], stats: { q: 0, s: 0, p: 0, n: 0, jsp: 0, motifs: [0, 0, 0, 0], valB: 0, rejB: 0 }, top: [], signals: [], hist: [], logs: [] });
