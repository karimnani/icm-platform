import { pages } from './view.js';
import { actions, changes, loadIndicators } from './actions.js';

export const feature = { pages, actions, changes, mounts: { indicateurs: loadIndicators } };
