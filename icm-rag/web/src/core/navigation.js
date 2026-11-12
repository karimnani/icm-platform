import { MAILS, ROLES } from './referentials.js';
import { S, projName } from './state.js';
import { esc, opt } from './format.js';
import { ic } from './icons.js';

export const MENU = [
  { sect: 'Exploiter', roles: ['technicien', 'admin'] },
  { id: 'chatbot', l: 'Assistant IA', i: 'chat', roles: ['technicien', 'admin'] },
  { id: 'documents', l: 'Recherche documentaire', i: 'search', roles: ['technicien', 'admin'] },
  { id: 'interventions', l: 'Interventions', i: 'cr', roles: ['technicien', 'admin'] },
  { sect: 'Construire et qualifier', roles: ['admin'] },
  { id: 'projets', l: 'Projets et arborescences', i: 'tree', roles: ['admin'] },
  { id: 'integration', l: 'Intégration documentaire', i: 'up', roles: ['admin'] },
  { id: 'ingestion', l: 'Ingestion RAG (serveur)', i: 'layers', roles: ['admin'] },
  { id: 'validation', l: 'Validation des connaissances', i: 'val', roles: ['admin'] },
  { sect: 'Piloter et administrer', roles: ['admin'] },
  { id: 'indicateurs', l: 'Indicateurs de pilotage', i: 'chart', roles: ['admin'] },
  { id: 'historique', l: 'Historique et traçabilité', i: 'hist', roles: ['admin'] },
  { id: 'comptes', l: 'Comptes et droits', i: 'usr', roles: ['admin'] },
  { id: 'connecteurs', l: 'Configuration et connecteurs', i: 'plug', roles: ['admin'] }
];
export const ACCESS = { document: ['technicien', 'admin'], compte: ['technicien', 'admin'] };
MENU.forEach((m) => { if (m.id) ACCESS[m.id] = m.roles; });
export const home = () => (S.role === 'admin' ? 'projets' : 'chatbot');

export function shell(active, body) {
  const items = MENU.filter((m) => m.roles.includes(S.role)).map((m) => m.sect ? `<div class="sect">${m.sect}</div>`
    : m.soon ? `<span class="nav off" title="Prévu dans une prochaine version">${ic(m.i)}<span>${m.soon}<br><span style="font-size:12px">à venir</span></span></span>`
    : `<a class="nav${active === m.id ? ' on' : ''}" href="#${m.id}"${active === m.id ? ' aria-current="page"' : ''}>${ic(m.i)}${m.l}</a>`).join('');
  const proj = S.role === 'admin' || S.projects.length > 1   // un technicien affecté à plusieurs projets peut en changer
    ? `<label class="proj"><span>Projet</span><select class="in" style="min-height:34px;border:none;padding:0;font-weight:600" data-input="project">${opt(S.projects.map((p) => [p.id, p.n]), S.project)}</select></label>`
    : `<div class="proj"><span>Projet</span><b style="font-weight:600">${esc(projName())}</b></div>`;
  return `<div class="app"><nav class="side" aria-label="Navigation principale"><div class="brand">ICM</div>${proj}${items}
    <div class="user"><b style="font-weight:600">${esc(S.userMail || MAILS[S.role])}</b><span class="muted" style="font-size:13px">Rôle : ${ROLES[S.role]}</span>
    <a class="nav" href="#compte" style="padding:0;font-weight:600">${ic('usr', 18)}Mon compte</a>
    <a class="nav" href="#connexion" data-act="logout" style="padding:0;font-weight:600;color:var(--p)">${ic('out', 18)}Déconnexion</a></div></nav>
    <main>${S.busy ? '<div class="alert t-in" role="status">Enregistrement en cours…</div>' : ''}${S.err ? `<div class="alert t-ko" role="alert" style="margin-bottom:16px">${esc(S.err)}</div>` : ''}${body}</main></div>`;
}
