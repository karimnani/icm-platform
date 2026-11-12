import { S } from '../../core/state.js';
import { sendToServer, ACCEPT } from '../ingestion-screen/upload.js';
import { hydrate } from '../../core/remote.js';

/** Téléversement RÉEL des documents (lecture → envoi au Worker → indexation) avec états explicites : en attente, en cours, indexé, échec. */
export const MAX_BYTES = 50 * 1024 * 1024;
export { ACCEPT, sendToServer };   // ré-exportés : les importeurs existants ne changent pas
const EXT_OK = ['pdf', 'docx', 'xlsx', 'xls'];
const FILES = new Map();   // nom → objet File (non conservé dans l'état affiché)
let running = false;

export const sizeLabel = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko');
export const canRetry = (name) => FILES.has(name);
export const forget = (name) => FILES.delete(name);

/** Motif de refus avant tout envoi (chaîne vide = fichier accepté). */
export function rejectReason(file, d) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (!EXT_OK.includes(ext)) return 'Format non supporté (PDF, Word .docx, Excel .xlsx/.xls).';
  if (file.size > MAX_BYTES) return 'Fichier trop volumineux (50 Mo maximum).';
  if (d.docs.some((x) => x.n === file.name)) return 'Un document de ce nom existe déjà dans ce projet : utilisez « Nouvelle version » sur sa fiche.';
  return '';
}

export function addFiles(list, d, render) {
  for (const file of list) {
    const reason = rejectReason(file, d);
    let f = d.files.find((x) => x.n === file.name);
    if (!f) { f = { n: file.name }; d.files.push(f); d.fmeta[file.name] = ['', '']; }
    Object.assign(f, { s: sizeLabel(file.size), p: 0, real: true, status: reason ? 'error' : 'queued', err: reason });
    if (!reason) FILES.set(file.name, file); else FILES.delete(file.name);
    d.upSel = file.name;
  }
  S.up.saved = false; render(); pump(d, render, S.project);
}

export function retry(name, d, render) {
  const f = d.files.find((x) => x.n === name);
  if (f && FILES.has(name)) { Object.assign(f, { status: 'queued', err: '', p: 0 }); render(); pump(d, render, S.project); }
}

async function pump(d, render, project) {   // un fichier à la fois
  if (running) return; running = true;
  try {
    for (let f; (f = d.files.find((x) => x.real && x.status === 'queued')); ) {
      f.status = 'sending'; f.p = 35; render();
      try { await sendToServer(FILES.get(f.n), { project }); await hydrate(project); f.status = 'done'; f.p = 100; f.err = ''; FILES.delete(f.n); }
      catch (e) { f.status = 'error'; f.p = 0; f.err = e.message || String(e); }
      render();
    }
  } finally { running = false; }
}

/** Glisser-déposer sur la zone de dépôt (reposé après chaque rendu). */
export function bindDrop(render) {
  const z = document.getElementById('dropzone'); if (!z) return;
  z.addEventListener('dragover', (e) => { e.preventDefault(); z.style.background = '#e6eef6'; });
  z.addEventListener('dragleave', () => { z.style.background = ''; });
  z.addEventListener('drop', (e) => { e.preventDefault(); z.style.background = ''; import('../../core/projectData.js').then(({ D }) => addFiles(Array.from(e.dataTransfer.files), D(), render)); });
}
