import { S } from '../../core/state.js';
import { pages } from './view.js';
import { actions, submits } from './actions.js';

/** À chaque navigation : revenir sur « mot de passe oublié » réaffiche le formulaire. */
const onHash = (hash) => { if (hash === '#motdepasse') S.recovered = false; };

export const feature = { pages, actions, submits, onHash };
