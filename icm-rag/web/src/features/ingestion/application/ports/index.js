/**
 * PORTS — contrats que la couche application attend des adaptateurs.
 *
 * @typedef {Object} RagGatewayPort           // serveur central (Worker)
 * @property {(project:string) => Promise<{docs?:object[]}>} list
 * @property {(project:string, name:string) => Promise<{status:number,text:string}>} deleteDocument
 * @property {(project:string) => Promise<{status:number,text:string}>} purge
 * @property {(p:{project:string,version:string,name:string,text?:string,file?:File}) => Promise<{status:number,text:string}>} ingest
 * @property {(question:string, project:string) => Promise<{status:number,text:string}>} ask
 *
 * @typedef {Object} WordReaderPort
 * @property {(file:File) => Promise<string>} extractRawText
 *
 * @typedef {Object} SpreadsheetReaderPort
 * @property {(file:File) => Promise<{sheetNames:string[], rowsOf:Function, csvOf:Function}>} read
 *
 * @typedef {Object} ConfirmerPort
 * @property {(message:string) => boolean} confirm
 */
export {};
