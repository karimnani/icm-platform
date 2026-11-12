import { json } from './responses.js';
import { withTimeout } from '../../../application/services/resilience.js';

/**
 * GET /api/health — sonde de supervision (sans authentification, aucune donnée métier).
 * Vérifie la présence des liaisons et répond à une requête D1 minimale ; 200 si tout est prêt, 503 sinon.
 */
export function makeHealthHandler({ db, hasAi, hasVectorize, hasSecret }) {
  return async function health() {
    const checks = { d1: false, ai: !!hasAi, vectorize: !!hasVectorize, auth_secret: !!hasSecret };
    try { await withTimeout(() => db.prepare('SELECT 1 AS ok').first(), 1500, 'Sonde D1'); checks.d1 = true; } catch (e) { console.error('health D1 :', e); }
    const ok = Object.values(checks).every(Boolean);
    return json({ ok, ...checks, time: new Date().toISOString() }, ok ? 200 : 503);
  };
}
