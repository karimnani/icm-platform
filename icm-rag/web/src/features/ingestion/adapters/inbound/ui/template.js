/** Gabarit HTML du module. Les éléments sont repérés par data-ref (aucun id global → pas de collision avec l'app hôte). */
export const renderTemplate = ({ allowPurge }) => `
<section class="ii-card"><h2 class="ii-title">Documents présents sur le serveur (Backend)</h2>
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <p class="ii-hint" style="margin:0">Inventaire centralisé sur le serveur.</p>
    <div class="ii-btn-group">
      <button data-ref="btnList" class="ii-btn ii-btn-sec" style="font-size:13px;padding:6px 14px">↻ Actualiser la liste</button>
      ${allowPurge ? '<button data-ref="btnPurge" class="ii-btn ii-btn-purge" title="Supprime tous les documents et vecteurs du projet">⚠️ Purger toute la base</button>' : ''}
    </div>
  </div>
  <div data-ref="tableWrap">
    <p class="ii-hint" style="text-align:center;padding:16px 0">Chargement depuis le serveur…</p>
  </div>
  <pre class="ii-out" data-ref="outDel" style="display:none"></pre>
</section>

<section class="ii-card"><h2 class="ii-title">Ajouter un document technique</h2>
  <div class="ii-formats">
    <span class="ii-badge">PDF</span>
    <span class="ii-badge">WORD (.docx)</span>
    <span class="ii-badge">EXCEL (.xlsx, .xls)</span>
  </div>
  <label class="ii-label">Fichier à indexer<input class="ii-input" data-ref="file" type="file" accept=".pdf, .docx, .xlsx, .xls"></label>
  <label class="ii-label">Numéro de version<input class="ii-input" data-ref="ver" value="1" inputmode="numeric"></label>
  <button class="ii-btn" data-ref="go">Envoyer et indexer au serveur</button>
  <pre class="ii-out" data-ref="out1"></pre>
</section>

<section class="ii-card"><h2 class="ii-title">Tester une question</h2>
  <label class="ii-label">Question<input class="ii-input" data-ref="q" value="Quelle est la consigne de maintenance ?"></label>
  <button class="ii-btn" data-ref="ask">Poser la question à l'IA</button>
  <pre class="ii-out" data-ref="out2"></pre>
</section>`;
