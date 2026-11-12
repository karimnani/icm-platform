const pending = new Map();

/** Charge un script externe une seule fois, sauf si la librairie est déjà présente. */
export function loadScriptOnce(src, isReady) {
  if (isReady()) return Promise.resolve();
  if (!pending.has(src)) {
    pending.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { pending.delete(src); reject(new Error('Impossible de charger ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return pending.get(src);
}
