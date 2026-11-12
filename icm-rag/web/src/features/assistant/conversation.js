import { S } from '../../core/state.js';
import { D } from '../../core/projectData.js';
import { toAssistantMessage, describeFailure } from './domain/chatReply.js';

/**
 * Logique de conversation de l'Assistant IA : chaque question part au serveur RAG,
 * dans l'espace du projet actif au moment de la question.
 * onChange(project) est appelé à chaque changement visible (réponse en attente, réponse, erreur).
 */
export function createAssistant({ gateway }) {
  async function run(answer, question, project, onChange, conv) {
    answer.pending = true; answer.err = ''; answer.t = ''; answer.src = [];
    onChange(project);
    try {
      const reply = toAssistantMessage(await gateway.ask({ question, project, ...(answer.node ? { node: answer.node } : {}), ...(conv && conv.sid ? { discussion: conv.sid } : {}) }));
      answer.t = reply.t; answer.src = reply.src;
      if (reply.mid) answer.mid = reply.mid;
      if (reply.did && conv) conv.sid = reply.did;
    } catch (e) { answer.err = describeFailure(e); }
    answer.pending = false;
    onChange(project);
  }

  function ask(q, onChange = () => {}) {
    q = (q || '').trim(); if (!q) return null;
    const d = D(); let conv = d.convs.find((x) => x.id === d.conv);
    if (!conv) { conv = { id: 'c' + Date.now(), title: 'Nouvelle conversation', date: "Aujourd'hui", msgs: [] }; d.convs.unshift(conv); d.conv = conv.id; }
    if (conv.msgs.some((m) => m.pending)) return null; // une question à la fois
    const t = Date.now(), answer = { id: 'a' + t, u: false, t: '', src: [] };
    if (S.chat.node) answer.node = S.chat.node;   // périmètre (équipement) choisi pour cette question
    conv.msgs.push({ id: 'u' + t, u: true, t: q }, answer);
    if (conv.title === 'Nouvelle conversation') conv.title = q.length > 34 ? q.slice(0, 34) + '…' : q;
    S.chat.draft = '';
    return run(answer, q, S.project, onChange, conv);
  }

  function retry(answerId, onChange = () => {}) {
    const conv = D().convs.find((c) => c.msgs.some((m) => m.id === answerId));
    if (!conv || conv.msgs.some((m) => m.pending)) return null;
    const i = conv.msgs.findIndex((m) => m.id === answerId), answer = conv.msgs[i], question = conv.msgs[i - 1];
    if (!answer || !answer.err || !question || !question.u) return null;
    return run(answer, question.t, S.project, onChange, conv);
  }

  return { ask, retry };
}
