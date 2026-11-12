/** Paramètres techniques et métier du Worker (aucune logique ici). */
export const EMBED_MODEL = '@cf/baai/bge-m3';
export const LLM_MODEL = '@cf/meta/llama-3.2-3b-instruct';

export const TOP_K = 5;
export const MIN_SCORE = 0.40;
export const CHUNK_SIZE = 1500;
export const CHUNK_OVERLAP = 200;

export const EMBED_BATCH_SIZE = 10;
export const UPSERT_BATCH_SIZE = 50;
export const LLM_MAX_TOKENS = 512;
export const MIN_CONTENT_CHARS = 30;

/** Recherche limitée à un périmètre (équipement) : on interroge plus large (max. 20 avec métadonnées) puis on filtre. */
export const SCOPE_FETCH = 20;
export const SEARCH_RESULTS = 8;

/** Nombre d'identifiants de vecteurs supprimés par paquet, et nombre de paquets par document. */
export const DELETE_BATCH_SIZE = 100;
export const DELETE_BATCHES_PER_DOC = 2;

export const DEFAULT_PROJECT = 'lyon';

/** Durée de conservation des conversations (jours) pour la purge planifiée ; variable Worker RETENTION_DAYS pour la changer (minimum 30). */
export const RETENTION_DAYS = 365;

// URL Firebase officielle
export const FIREBASE_URL = 'https://maser-icm-default-rtdb.europe-west1.firebasedatabase.app';

/** Anciens documents de test nettoyés lors d'une purge (1 paquet de 100 ids chacun). */
export const LEGACY_TEST_DOCUMENTS = [
  'APS x ICAM Sujet pour septembre #26.pdf',
  'OLA_Decoupage_Simple (1).xlsx',
  'Pilotage_RAG_Firebase_Supabase_v2.xlsx',
  'RAG_Projet_Feuille_de_Route_Enterprise.xlsx',
  'guide-maintenance.pdf',
];

export const SERVICE_NAME = 'ICM RAG Backend Firebase Intégral';

export const settings = Object.freeze({
  TOP_K, MIN_SCORE, CHUNK_SIZE, CHUNK_OVERLAP, UPSERT_BATCH_SIZE, LLM_MAX_TOKENS,
  MIN_CONTENT_CHARS, SCOPE_FETCH, SEARCH_RESULTS, DELETE_BATCH_SIZE, DELETE_BATCHES_PER_DOC, DEFAULT_PROJECT, LEGACY_TEST_DOCUMENTS,
});
