export const vectorId = (hash, index) => hash + '_' + index;

/** Génère `count` identifiants consécutifs à partir de `start`. */
export const vectorIdRange = (hash, start, count) =>
  Array.from({ length: count }, (_, i) => vectorId(hash, start + i));
