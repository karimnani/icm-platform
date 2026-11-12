import { loadScriptOnce } from './scriptLoader.js';

const MAMMOTH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';

/** Lecteur Word (.docx) : charge `mammoth` à la demande. */
export function createMammothWordReader() {
  return {
    async extractRawText(file) {
      await loadScriptOnce(MAMMOTH_URL, () => typeof mammoth !== 'undefined');
      const arrayBuffer = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer });
      return res.value;
    }
  };
}
