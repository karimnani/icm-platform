/** Branche le DOM du module sur les use cases : écoute des événements + affichage. Aucune logique métier. */
export function bindIngestionUi({ refs, view, useCases, getProject }) {
  async function loadList() {
    view.showLoading();
    try {
      const docs = await useCases.listDocuments({ project: getProject() });
      if (!docs.length) return view.showEmpty();
      view.showDocuments(docs);
    } catch (e) {
      view.showError(e.message);
    }
  }

  const showDelPanel = (text) => { refs.outDel.style.display = 'block'; refs.outDel.textContent = text; };

  async function runDestructive(useCase, args) {
    try {
      const res = await useCase({ ...args, onProgress: showDelPanel });
      if (res.cancelled) return;
      refs.outDel.textContent = res.report;
      loadList();
    } catch (e) {
      refs.outDel.textContent = 'Erreur : ' + e.message;
    }
  }

  view.onDeleteClick((name) => runDestructive(useCases.deleteDocument, { name, project: getProject() }));
  if (refs.btnPurge) refs.btnPurge.onclick = () => runDestructive(useCases.purgeProject, { project: getProject() });
  refs.btnList.onclick = loadList;

  refs.go.onclick = async () => {
    const f = refs.file.files[0];
    if (!f) { refs.out1.textContent = 'Veuillez choisir un fichier.'; return; }

    refs.go.disabled = true;
    refs.out1.textContent = 'Préparation du document…';
    try {
      refs.out1.textContent = await useCases.ingestFile({
        file: f, project: getProject(), version: refs.ver.value,
        onProgress: (t) => { refs.out1.textContent = t; }
      });
      loadList();
    } catch (e) {
      refs.out1.textContent = 'Erreur : ' + e.message;
    }
    refs.go.disabled = false;
  };

  refs.ask.onclick = async () => {
    try {
      refs.out2.textContent = await useCases.askQuestion({
        question: refs.q.value, project: getProject(),
        onProgress: (t) => { refs.out2.textContent = t; }
      });
    } catch (e) {
      refs.out2.textContent = 'Erreur : ' + e.message;
    }
  };

  return { loadList };
}
