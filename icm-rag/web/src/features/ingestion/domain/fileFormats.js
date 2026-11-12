export const MIN_TEXT_LENGTH = 30;
export const extensionOf = (fileName) => fileName.toLowerCase().split('.').pop();
export const isExcel = (ext) => ext === 'xlsx' || ext === 'xls';
export const isWord = (ext) => ext === 'docx';
export const isPdf = (ext) => ext === 'pdf';
