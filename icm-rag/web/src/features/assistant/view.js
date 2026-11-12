import { D } from '../../core/projectData.js';
import { MOTIFS } from '../../core/referentials.js';
import { S } from '../../core/state.js';
import { esc, opt } from '../../core/format.js';
import { ic } from '../../core/icons.js';
import { shell } from '../../core/navigation.js';
import { nodeOpts } from '../../core/tree.js';

import { sourceLocator } from './domain/chatReply.js';
export const pages = {};

pages.chatbot = () => {
  const d = D(), conv = d.convs.find((c) => c.id === d.conv);
  const fbBlock = (m) => {
    const f = d.fb[m.id] || {};
    if (f.sent) return `<div class="muted" style="font-size:13px;font-weight:600;border-top:1px solid #e3e8ee;padding-top:12px">Évaluation enregistrée : ${esc(f.e)}${f.m ? ' · ' + esc(f.m) : ''}.</div>`;
    const E = ['Oui, réponse satisfaisante', 'Partiellement', 'Non, réponse incorrecte'];
    return `<fieldset style="border:none;border-top:1px solid #e3e8ee;margin:0;padding:12px 0 0;display:flex;flex-direction:column;gap:2px"><legend class="lbl" style="padding:0 0 4px">Cette réponse vous a-t-elle été utile ?</legend>
      ${E.map((e) => `<label class="choice" style="min-height:34px"><input type="radio" name="e${m.id}" data-act="fbe" data-id="${m.id}" data-v="${e}"${f.e === e ? ' checked' : ''}>${e}</label>`).join('')}
      ${f.e && f.e !== E[0] ? `<span class="lbl" style="margin-top:6px">Pourquoi ?</span>${MOTIFS.map((x) => `<label class="choice" style="min-height:34px"><input type="radio" name="m${m.id}" data-act="fbm" data-id="${m.id}" data-v="${x}"${f.m === x ? ' checked' : ''}>${x}</label>`).join('')}
        <label class="sr" for="fc${m.id}">Commentaire</label><textarea id="fc${m.id}" class="in" style="min-height:60px;margin-top:4px" placeholder="Commentaire${f.m === 'Autre motif' ? ' (précisez le motif)' : ' (facultatif)'}"></textarea>` : ''}
      ${f.err ? `<div class="alert t-ko" role="alert" style="margin-top:6px">${esc(f.err)}</div>` : ''}
      ${f.e ? `<div style="margin-top:8px"><button class="btn sm" data-act="fbsend" data-id="${m.id}"${(f.e !== E[0] && !f.m) || f.busy ? ' disabled' : ''}>${f.busy ? 'Envoi…' : 'Envoyer l\'évaluation'}</button></div>` : ''}</fieldset>`;
  };
  const known = (n) => d.docs.some((x) => x.n === n);
  const where = (x) => { const j = [x[4] ? 'page ' + x[4] : '', sourceLocator(x[2])].filter(Boolean).join(' · '); return j ? ' · ' + j : ''; };
  const srcTitle = (x) => `${esc(x[0])} · version ${x[1]}${where(x)}`;
  const bubble = 'align-self:flex-start;max-width:86%;border-radius:14px 14px 14px 4px;padding:16px;';
  const msg = (m) => m.u ? `<div style="align-self:flex-end;max-width:72%;background:var(--p);color:#fff;padding:12px 16px;border-radius:14px 14px 4px 14px;line-height:1.5">${esc(m.t)}</div>`
    : m.pending ? `<div role="status" aria-live="polite" class="muted" style="${bubble}background:var(--bg);border:1px solid #e3e8ee">Recherche dans les documents du projet…</div>`
    : m.err ? `<div role="alert" style="${bubble}background:var(--kot);color:var(--kox);display:flex;flex-direction:column;gap:10px"><div style="line-height:1.6;font-weight:600">La réponse n’a pas pu être obtenue.</div><div style="font-size:14px;line-height:1.5">${esc(m.err)}</div><div><button class="btn sec sm" data-act="retry" data-id="${esc(m.id)}">Réessayer</button></div></div>`
    : `<div style="align-self:flex-start;max-width:86%;background:var(--bg);border:1px solid #e3e8ee;padding:16px;border-radius:14px 14px 14px 4px;display:flex;flex-direction:column;gap:14px">
      <div style="line-height:1.6;white-space:pre-wrap">${esc(m.t)}</div>
      ${m.src.length ? `<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid #e3e8ee;padding-top:12px"><div class="muted" style="font-size:13px;font-weight:600">Sources utilisées</div>
        ${m.src.map((x) => `<div style="display:flex;flex-direction:column;gap:4px">${known(x[0]) ? `<a href="#document" data-act="opendoc" data-v="${esc(x[0])}" style="font-weight:600;text-decoration:none;font-size:14px">${srcTitle(x)}</a>` : `<span style="font-weight:600;font-size:14px">${srcTitle(x)}</span>`}<span style="font-size:14px;color:#3d4752;border-left:3px solid var(--bd2);padding-left:10px;font-family:'IBM Plex Serif',Georgia,serif">${esc(x[3])}</span></div>`).join('')}</div>`
        : `<div class="muted" style="font-size:13px;border-top:1px solid #e3e8ee;padding-top:12px">Aucune source trouvée : l'assistant ne répond pas sans document à l'appui.</div>`}
      ${fbBlock(m)}</div>`;
  const q = S.chat.draft.trim().toLowerCase(), words = q.split(/\s+/).filter((w) => w.length > 2);
  const live = q.length > 2 ? d.sugg.filter((x) => words.some((w) => x.toLowerCase().includes(w))).slice(0, 3) : [];
  const empty = !conv || !conv.msgs.length, busy = !!conv && conv.msgs.some((m) => m.pending);
  return shell('chatbot', `<div><h1>Assistant IA</h1><p class="sub">Posez une question en français : l'assistant répond à partir des documents du projet et cite chaque source (document, version, page).</p></div>
    <div class="row" style="align-items:stretch">
      <aside class="card" style="flex:1 1 240px;padding:16px;gap:8px" aria-label="Historique des conversations">
        <button class="btn" data-act="newconv">${ic('plus', 18)}Nouvelle conversation</button>
        <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:10px 4px 2px">Historique</div>
        ${d.convs.length ? d.convs.map((c) => `<button class="pill${c.id === d.conv ? ' on' : ''}" style="border-radius:8px;min-height:52px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;padding:6px 12px" data-act="conv" data-v="${c.id}"><span style="font-weight:600">${esc(c.title)}</span><span style="font-size:12px;opacity:.85">${c.date} · ${c.msgs.filter((x) => !x.u).reduce((a, x) => a + x.src.length, 0)} source(s)</span></button>`).join('') : '<p class="hint">Aucune conversation.</p>'}
      </aside>
      <div style="flex:4 1 520px;min-width:0;display:flex;flex-direction:column;gap:16px">
        <section aria-label="Conversation" class="card" style="min-height:440px;gap:20px">
        ${empty ? `<div style="margin:auto;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;max-width:560px">
            <div style="font-size:20px;font-weight:600">Que voulez-vous savoir ?</div>
            ${d.sugg.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">${d.sugg.slice(0, 4).map((t) => `<button class="pill" data-act="ask" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <button class="btn ghost sm" data-act="why">${ic('info', 16)}Comment sont choisies ces questions ?</button>
            ${S.chat.showWhy ? `<div class="note" style="text-align:left">Les questions proposées viennent des documents du projet et des interventions : sujets fréquents (graissage, consignation) et pannes récurrentes sur une même machine. Pendant la saisie, les propositions s'adaptent aux mots tapés.</div>` : ''}` : '<p class="hint">Posez votre première question : l’assistant interroge les documents indexés sur le serveur pour ce projet (écran « Ingestion RAG (serveur) »).</p>'}
          </div>` : conv.msgs.map(msg).join('')}
        </section>
        <form data-act="send" style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label for="cnode" class="muted" style="font-size:13px;font-weight:600">Périmètre de la recherche</label>
            <select id="cnode" class="in" style="width:auto;min-height:36px;max-width:100%" data-input="chatnode">${opt([['', 'Tout le projet'], ...nodeOpts()], S.chat.node)}</select>
            <span class="hint">Choisir un équipement écarte les documents des autres machines.</span></div>
          <div style="display:flex;gap:12px"><label for="qq" class="sr">Votre question</label>
            <input id="qq" class="in" style="flex:1 1 auto;min-height:52px;font-size:16px;width:auto" placeholder="Posez une question sur une machine, une procédure…" autocomplete="off" value="${esc(S.chat.draft)}" data-input="draft">
            <button class="btn" style="min-height:52px" type="submit"${busy ? ' disabled' : ''}>${ic('send', 18)}Envoyer</button></div>
          ${live.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="muted" style="font-size:13px">Questions proposées :</span>${live.map((t) => `<button type="button" class="pill" style="min-height:34px;font-size:13px" data-act="ask" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
        </form></div></div>`);
};
