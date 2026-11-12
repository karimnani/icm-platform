export const WORKER_URL_DEFAULT = 'https://icm-maser.salle-repos-icam-tls.workers.dev';
export const workerUrl = () => { try { return localStorage.getItem('icm.workerUrl') || WORKER_URL_DEFAULT; } catch (e) { return WORKER_URL_DEFAULT; } };
export const setWorkerUrl = (u) => { try { localStorage.setItem('icm.workerUrl', u); } catch (e) { /* stockage indisponible */ } };
