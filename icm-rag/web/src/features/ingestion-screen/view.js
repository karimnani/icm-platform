import { S, projName } from '../../core/state.js';
import { esc } from '../../core/format.js';
import { shell } from '../../core/navigation.js';
import { workerUrl } from '../../core/config.js';

export const pages = {};

pages.ingestion = () => shell('ingestion', `<div><h1>Ingestion RAG (serveur)</h1><p class="sub">Indexation réelle des documents du projet <b>${esc(projName())}</b> (<code>${esc(S.project)}</code>) dans le serveur RAG, et test de question. Le projet actif est celui du menu : l'Assistant IA interroge le même espace.</p></div>
    <section class="card"><div class="field"><label for="wurl">Adresse du Worker</label><input id="wurl" class="in" value="${esc(workerUrl())}" data-ingest-url></div></section>
    <div id="ingestion-root"></div>`);
