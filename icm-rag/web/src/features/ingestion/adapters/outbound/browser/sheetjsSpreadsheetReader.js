import { loadScriptOnce } from './scriptLoader.js';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

/** Lecteur Excel (.xlsx, .xls) : charge SheetJS (`XLSX`) à la demande. */
export function createSheetJsSpreadsheetReader() {
  return {
    async read(file) {
      await loadScriptOnce(XLSX_URL, () => typeof XLSX !== 'undefined');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      return {
        sheetNames: workbook.SheetNames,
        rowsOf: (name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' }),
        csvOf: (name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name]),
      };
    }
  };
}
