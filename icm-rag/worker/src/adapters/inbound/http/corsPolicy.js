/**
 * Restriction OPTIONNELLE de CORS : variable Worker ALLOWED_ORIGIN (une ou plusieurs origines séparées par des virgules,
 * ex. « https://icm-app.pages.dev »). Absente ou vide → comportement historique inchangé (Access-Control-Allow-Origin: *).
 * L'authentification repose sur l'en-tête Authorization (pas de cookie) : CORS limite surtout l'usage de l'API depuis d'autres sites.
 */
export function allowedOrigins(env) {
  return String((env && env.ALLOWED_ORIGIN) || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

export function applyCors(response, request, env) {
  const list = allowedOrigins(env);
  if (!list.length) return response;
  const origin = (request.headers.get('Origin') || '').replace(/\/+$/, '');
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', list.includes(origin) ? origin : list[0]);
  headers.append('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
