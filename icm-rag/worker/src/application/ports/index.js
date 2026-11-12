/**
 * PORTS (contrats) — la couche application ne dépend que de ces interfaces.
 * Chaque adaptateur sortant (Cloudflare, Firebase…) les implémente.
 *
 * @typedef {Object} EmbeddingPort
 * @property {(texts:string[]) => Promise<number[][]>} embed
 *
 * @typedef {Object} LlmPort
 * @property {(args:{messages:{role:string,content:string}[], maxTokens:number}) => Promise<string|undefined>} generate
 *
 * @typedef {Object} DocumentConverterPort
 * @property {(file:File) => Promise<string>} toMarkdown   // lève ApplicationError(422) si illisible
 *
 * @typedef {Object} VectorStorePort
 * @property {(records:object[]) => Promise<void>} upsert
 * @property {(vector:number[], opts:{topK:number, namespace:string}) => Promise<{score:number, metadata:object}[]>} query
 * @property {(ids:string[]) => Promise<void>} deleteByIds
 *
 * @typedef {Object} CatalogPort
 * @property {(project:string) => Promise<object[]>} list              // lève Error('Firebase error status: …')
 * @property {(project:string) => Promise<string[]>} listDocumentIds
 * @property {(project:string, entry:object) => Promise<{status:number}>} save
 * @property {(project:string, id:string) => Promise<void>} remove
 * @property {(project:string) => Promise<void>} removeAll
 */
export {};
