import { S } from '../../core/state.js';

const KEY = 'icm.gmao';
// Configuration mémorisée dans ce navigateur (jamais la clé d'accès).
try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c) { Object.assign(S.gmao.cfg, c.cfg || {}); if (Array.isArray(c.opts)) S.gmao.opts = c.opts; if (Array.isArray(c.map)) S.gmao.map = c.map; } } catch (e) { /* stockage indisponible */ }

export const actions = {
  /** Aucun connecteur GMAO n'est actif côté serveur : le test vérifie la saisie et le dit clairement, sans simuler une connexion. */
  gtest: () => {
    const u = S.gmao.cfg.url.trim();
    S.gmao.ok = false;
    S.gmao.msg = /^https:\/\/[^\s/]+\.[^\s/]+/.test(u)
      ? 'Adresse valide, mais le connecteur GMAO n’est pas encore actif sur le serveur : aucune connexion réelle n’a été testée.'
      : 'Adresse de l’API invalide : indiquez une adresse en https://…';
  },
  gsave: () => {
    S.gmao.saved = true;
    try { localStorage.setItem(KEY, JSON.stringify({ cfg: S.gmao.cfg, opts: S.gmao.opts, map: S.gmao.map })); } catch (e) { /* stockage indisponible */ }
  },
};

export const changes = {
  map: ({ v, i }) => { S.gmao.map[i][1] = v; S.gmao.saved = false; },
  gopt: ({ t, i }) => { S.gmao.opts[i] = t.checked; S.gmao.saved = false; },
};
