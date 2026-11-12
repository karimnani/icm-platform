import { pages } from './view.js';
import { actions, changes } from './actions.js';
import { bindDrop } from './uploader.js';

export const feature = { pages, actions, changes, mounts: { integration: bindDrop } };
