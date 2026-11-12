import { pages } from './view.js';
import { actions, changes } from './actions.js';

import { S } from '../../core/state.js';

/** Champs de connexion (attribut data-gcfg) : mémorisés sans nouveau rendu. */
const fields = { gcfg: ({ t }) => { S.gmao.cfg[t.dataset.gcfg] = t.value; S.gmao.saved = false; } };

export const feature = { pages, actions, changes, fields };
