import { feature as auth } from '../features/auth/index.js';
import { feature as projects } from '../features/projects/index.js';
import { feature as assistant } from '../features/assistant/index.js';
import { feature as documents } from '../features/documents/index.js';
import { feature as interventions } from '../features/interventions/index.js';
import { feature as integration } from '../features/integration/index.js';
import { feature as ingestionScreen } from '../features/ingestion-screen/index.js';
import { feature as validation } from '../features/validation/index.js';
import { feature as history } from '../features/history/index.js';
import { feature as accounts } from '../features/accounts/index.js';
import { feature as connectors } from '../features/connectors/index.js';
import { feature as indicators } from '../features/indicators/index.js';
import { feature as profile } from '../features/profile/index.js';

/**
 * Chaque écran est une « fonctionnalité » : { pages, actions, submits, inputs, changes, changeActs, fields, mounts, onHash }.
 *  pages       écran → HTML                      (clé = identifiant dans l'URL, ex. #chatbot)
 *  actions     clic sur [data-act]               submits     envoi d'un <form data-act>
 *  inputs      saisie [data-input]               changes     changement [data-input]
 *  changeActs  changement d'un [data-act]        fields      champs repérés par un attribut data-* (ex. data-cr)
 *  mounts      code à exécuter après le rendu d'un écran   onHash   réaction à un changement d'adresse
 * Un gestionnaire peut renvoyer false pour éviter le rendu qui suit normalement.
 */
export const FEATURES = [auth, projects, assistant, documents, interventions, integration, ingestionScreen, validation, history, accounts, connectors, indicators, profile];

/** Fusionne une table de toutes les fonctionnalités ; deux écrans ne peuvent pas définir la même clé. */
function merge(kind) {
  const out = {};
  for (const f of FEATURES) for (const [k, fn] of Object.entries(f[kind] || {})) {
    if (k in out) throw new Error(`Doublon « ${k} » dans ${kind} : deux fonctionnalités définissent la même clé.`);
    out[k] = fn;
  }
  return out;
}
export const pages = merge('pages');
export const actions = merge('actions');
export const submits = merge('submits');
export const inputs = merge('inputs');
export const changes = merge('changes');
export const changeActs = merge('changeActs');
export const fields = merge('fields');
export const mounts = merge('mounts');
export const hashHooks = FEATURES.map((f) => f.onHash).filter(Boolean);
