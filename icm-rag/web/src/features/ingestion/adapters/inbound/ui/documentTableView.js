const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Rendu du tableau de documents (le clic « Supprimer » est géré par délégation d'événement). */
export function createDocumentTableView(container) {
  return {
    showLoading() {
      container.innerHTML = '<p class="ii-hint" style="text-align:center;padding:12px">Interrogation du serveur…</p>';
    },
    showEmpty() {
      container.innerHTML = '<p class="ii-hint" style="text-align:center;padding:16px 0">Aucun document sur le serveur pour ce projet.</p>';
    },
    showError(message) {
      container.innerHTML = '<p class="ii-error">Erreur Backend : ' + escapeHtml(message) + '</p>';
    },
    showDocuments(docs) {
      let h = '<table class="ii-table"><thead><tr><th>Document</th><th>Ver.</th><th>Morceaux</th><th>Date</th><th>Action</th></tr></thead><tbody>';
      docs.forEach(d => {
        h += `<tr>
        <td><b>${escapeHtml(d.title)}</b></td>
        <td>v${escapeHtml(d.version)}</td>
        <td>${escapeHtml(d.chunks)}</td>
        <td>${escapeHtml(d.date)}</td>
        <td><button class="ii-btn ii-btn-del" data-doc="${escapeHtml(d.title)}">🗑️ Supprimer</button></td>
      </tr>`;
      });
      h += '</tbody></table>';
      container.innerHTML = h;
    },
    onDeleteClick(handler) {
      container.addEventListener('click', (e) => {
        const btn = e.target.closest('button.ii-btn-del');
        if (btn) handler(btn.dataset.doc);
      });
    }
  };
}
