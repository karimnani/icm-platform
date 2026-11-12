import { ChatError } from '../domain/chatReply.js';

/** Appelle la route « chat » du Worker (POST / { action: 'chat', question, project }). */
export function createWorkerChatGateway({ getBaseUrl, fetchFn = (...a) => fetch(...a), timeoutMs = 60000, getToken = () => '' }) {
  return {
    async ask({ question, project, node, discussion }) {
      const base = String(getBaseUrl() || '').trim().replace(/\/+$/, '');
      if (!base) throw new ChatError('L’adresse du serveur RAG n’est pas renseignée.');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        // Connecté : route applicative (réponse + conversation enregistrée + périmètre). Sinon : route RAG historique.
        const token = getToken();
        const res = await fetchFn(token ? base + '/api/projets/' + encodeURIComponent(project) + '/chat' : base + '/', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify(token ? { question, node_id: node || undefined, discussion_id: discussion || undefined } : { action: 'chat', question, project }), signal: ctrl.signal
        });
        const text = await res.text();
        let payload = null; try { payload = JSON.parse(text); } catch (e) { /* corps non JSON */ }
        if (!res.ok) throw new ChatError('Le serveur a répondu ' + res.status + (payload && payload.error ? ' : ' + payload.error : '') + '.');
        return payload;
      } catch (e) {
        if (e instanceof ChatError) throw e;
        if (e && e.name === 'AbortError') throw new ChatError('Le serveur n’a pas répondu dans le délai imparti.');
        throw new ChatError('Serveur RAG injoignable (' + base + '). Vérifiez la connexion et l’adresse du Worker.');
      } finally { clearTimeout(timer); }
    }
  };
}
