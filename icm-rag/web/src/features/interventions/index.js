import { S } from '../../core/state.js';
import { pages } from './view.js';
import { actions, submits } from './actions.js';

/** Champs du formulaire d'intervention (attribut data-cr) : mis à jour sans nouveau rendu. */
const fields = { cr: ({ t }) => { S.cr.f[t.dataset.cr] = t.value; } };

export const feature = { pages, actions, submits, fields };
