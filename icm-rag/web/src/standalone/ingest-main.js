import { mountIngestion } from '../features/ingestion/index.js';

const url = document.getElementById('url');
const proj = document.getElementById('proj');

const ingestion = mountIngestion(document.getElementById('ingestion-root'), {
  getBaseUrl: () => url.value,
  getProject: () => proj.value,
});
proj.onchange = ingestion.refresh;
