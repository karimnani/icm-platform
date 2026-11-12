/** Client HTTP du Worker central. @returns {import('../../../application/ports/index.js').RagGatewayPort} */
export function createHttpRagGateway({ getBaseUrl, fetchFn = (...a) => fetch(...a), getToken = () => '' }) {
  const auth = () => (getToken() ? { Authorization: 'Bearer ' + getToken() } : {});   // jeton de session (routes RAG protégées si RAG_REQUIRE_AUTH)
  const raw = async (res) => ({ status: res.status, text: await res.text() });
  const form = (entries) => { const fd = new FormData(); entries.forEach(([k, v]) => fd.append(k, v)); return fd; };
  const postJson = (path, body) => fetchFn(getBaseUrl() + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(body)
  });

  return {
    async list(project) {
      const r = await postJson('/list', { project });
      return r.json();
    },
    async deleteDocument(project, name) {
      return raw(await fetchFn(getBaseUrl() + '/delete', { method: 'POST', headers: auth(), body: form([['doc', name], ['project', project]]) }));
    },
    async purge(project) {
      return raw(await fetchFn(getBaseUrl() + '/purge', { method: 'POST', headers: auth(), body: form([['project', project]]) }));
    },
    async ingest({ project, version, name, text, file, note }) {
      const entries = [['project', project], ['version', version], ['name', name]];
      if (note) entries.push(['note', note]);
      if (text !== undefined) entries.push(['text', text]);
      if (file !== undefined) entries.push(['file', file]);
      return raw(await fetchFn(getBaseUrl() + '/ingest', { method: 'POST', headers: auth(), body: form(entries) }));
    },
    async ask(question, project) {
      return raw(await postJson('/', { action: 'chat', question, project }));
    }
  };
}
