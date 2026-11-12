import { D } from '../../core/projectData.js';
import { S } from '../../core/state.js';
import { val } from '../../core/format.js';
import { api, getToken } from '../../core/api.js';
import { NIVEAU } from '../../core/mapping.js';
import { createAssistant } from './conversation.js';
import { createWorkerChatGateway } from './adapters/workerChatGateway.js';
import { workerUrl } from '../../core/config.js';


/** Même adresse que l'écran « Ingestion RAG (serveur) » : une seule source de vérité (core/config.js). */
export const assistant = createAssistant({ gateway: createWorkerChatGateway({ getBaseUrl: workerUrl, getToken }) });

/** Rafraîchit l'écran quand une réponse arrive, seulement si l'utilisateur est encore sur l'Assistant du même projet. */
const refresher = (render) => (project) => { if (S.role && S.project === project && location.hash === '#chatbot') render(true); };

export const actions = {
  conv: ({ d, v }) => { d.conv = v; },
  newconv: ({ d }) => { const id = 'c' + Date.now(); d.convs.unshift({ id, title: 'Nouvelle conversation', date: "Aujourd'hui", msgs: [] }); d.conv = id; },
  ask: ({ v, render }) => { assistant.ask(v, refresher(render)); },
  retry: ({ b, render }) => { assistant.retry(b.dataset.id, refresher(render)); },
  why: () => { S.chat.showWhy = !S.chat.showWhy; },
  /** Évaluation enregistrée en base (table note) : elle alimente les indicateurs et la file « réponses signalées » de l'administrateur. */
  fbsend: ({ b, d, render }) => {
    const id = b.dataset.id, f = d.fb[id], conv = d.convs.find((c) => c.msgs.some((m) => m.id === id)), am = conv && conv.msgs.find((m) => m.id === id);
    if (!f || f.busy) return false;
    if (!am || !am.mid) { f.err = 'Évaluation impossible : cette réponse n’a pas été enregistrée sur le serveur.'; return; }
    f.err = ''; f.busy = true;
    api.rate(S.project, am.mid, { niveau: NIVEAU[f.e], motif: f.m || undefined, commentaire: val('fc' + id) })
      .then(() => { f.sent = true; })
      .catch((e) => { if (e.status === 409) f.sent = true; else f.err = e.message; })
      .finally(() => { f.busy = false; render(); });
    return;   // un rendu immédiat affiche l'envoi en cours
  },
};

export const submits = {
  send: ({ render }) => { assistant.ask(val('qq'), refresher(render)); render(); const q = document.getElementById('qq'); if (q) q.focus(); return false; },
};

export const inputs = {
  draft: ({ t }) => { S.chat.draft = t.value; },
};

export const changes = {
  chatnode: ({ v }) => { S.chat.node = v; },
};

export const changeActs = {
  fbe: ({ t }) => { const f = D().fb[t.dataset.id] = D().fb[t.dataset.id] || {}; f.e = t.dataset.v; if (f.e[0] === 'O') f.m = ''; },
  fbm: ({ t }) => { const f = D().fb[t.dataset.id] = D().fb[t.dataset.id] || {}; f.m = t.dataset.v; },
};
