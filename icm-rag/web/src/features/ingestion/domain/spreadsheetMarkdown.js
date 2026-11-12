/**
 * Convertit un classeur en texte Markdown indexable.
 * @param {{sheetNames:string[], rowsOf:(n:string)=>object[], csvOf:(n:string)=>string}} reader
 */
export function spreadsheetToMarkdown(reader, fileName) {
  let output = `# Document : ${fileName}\n\n`;
  reader.sheetNames.forEach(sheetName => {
    output += `## Feuille : ${sheetName}\n\n`;
    const rows = reader.rowsOf(sheetName);
    if (rows.length > 0) {
      rows.forEach((row, idx) => {
        const rowStr = Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | ');
        output += `Ligne ${idx + 1} : ${rowStr}\n`;
      });
      output += '\n';
    } else {
      const csv = reader.csvOf(sheetName);
      if (csv.trim()) output += csv + '\n\n';
    }
  });
  return output;
}
