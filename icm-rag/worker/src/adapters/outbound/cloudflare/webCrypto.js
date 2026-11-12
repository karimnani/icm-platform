/** Mots de passe (PBKDF2-SHA256, 100 000 itérations = maximum accepté par Workers) et jetons de session signés (HMAC-SHA256). */
const enc = new TextEncoder();
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64Url = (s) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s) => s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
const ITER = 100000;

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}
const sameBytes = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; };

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${toB64(salt)}$${toB64(await pbkdf2(password, salt, ITER))}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2' || !salt || !hash) return false;
  const got = new Uint8Array(await pbkdf2(password, fromB64(salt), Number(iter)));
  return sameBytes(got, fromB64(hash));
}

const hmacKey = (secret) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/** Jeton = base64url(JSON) . base64url(HMAC). `ttlSeconds` borne sa durée de vie. */
export async function signToken(payload, secret, ttlSeconds = 12 * 3600) {
  const body = toB64Url(btoa(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const sig = toB64Url(toB64(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body))));
  return `${body}.${sig}`;
}

export async function verifyToken(token, secret) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64(fromB64Url(sig)), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(atob(fromB64Url(body)));
    return p.exp > Math.floor(Date.now() / 1000) ? p : null;
  } catch { return null; }
}

export const randomPassword = () => toB64Url(toB64(crypto.getRandomValues(new Uint8Array(12))));
