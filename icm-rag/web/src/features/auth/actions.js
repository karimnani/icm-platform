import { S } from '../../core/state.js';
import { val } from '../../core/format.js';
import { doLogin, logout } from '../../core/remote.js';

export const actions = {
  logout: () => { logout(); return false; },
};

export const submits = {
  login: ({ render }) => { doLogin(val('mail'), val('pw'), render); return false; },
  recover: () => { const m = val('rmail').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) { document.getElementById('rerr').textContent = 'Saisissez une adresse e-mail valide.'; return false; } S.recovered = true; },
};
