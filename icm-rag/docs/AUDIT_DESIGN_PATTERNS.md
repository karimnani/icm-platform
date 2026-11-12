# Audit des design patterns et de l'architecture

Méthode : lecture du code + analyse automatique des imports (`scripts/check-architecture.mjs`, rejouable). Chaque constat cite le fichier concerné. Ce qui est **corrigé** l'est avec les 75 tests au vert (aucun test modifié).

## 1. Verdict
Le **cœur RAG du Worker** est une vraie architecture hexagonale, bien tenue (domaine pur, ports, adaptateurs interchangeables, injection par constructeur, racine de composition). Le **front** est une architecture par fonctionnalités avec registre, propre au niveau des dépendances. Les faiblesses se concentrent sur **la partie `/api` du Worker** (logique métier dans un adaptateur, dépôt SQL monolithique) et sur **l'état global du front**.

## 2. Patterns correctement utilisés (vérifiés)
| Pattern | Où | Preuve |
|---|---|---|
| **Architecture hexagonale (ports & adaptateurs)** | `worker/src` | `application/ports/index.js` déclare 5 ports (Embedding, Llm, DocumentConverter, VectorStore, Catalog) ; `adapters/outbound/{cloudflare,firebase,d1}` les implémentent ; le domaine n'importe que du domaine. |
| **Injection de dépendances (par fermeture / constructeur)** | tous les cas d'usage | `makeAskQuestion({ embedder, vectorStore, llm, settings })` : aucun `import` d'infrastructure, d'où des tests avec de faux Vectorize/IA. |
| **Racine de composition** | `composition/buildApp.js` | seul endroit qui connaît toutes les classes concrètes et les assemble. |
| **Strategy / Adapter (catalogue interchangeable)** | `buildApp.js` : `db ? createD1Catalog : createFirebaseCatalog` | deux implémentations du même port `CatalogPort`, choisies à l'assemblage. |
| **Repository** | `adapters/outbound/d1/d1Repository.js` | tout le SQL est isolé ; ni le domaine ni l'application n'en contiennent. |
| **Domain Service / Policy** | `domain/rag/answerPolicy.js`, `application/services/vectorCleanup.js` | règles de réponse (« Je ne sais pas », seuil, mise en forme des sources) isolées et testées. |
| **Composite** | `domain/tree.js` | `buildTree`, `subtreeIds`, `ancestorIds` : parcours récursifs de l'arborescence Site › Atelier › Ligne › Machine. |
| **Front Controller / table de routage** | `apiHandler.js` (`on(method, path, fn)` + boucle de `handle`), `router.js` | résolution des routes, authentification déclarative (`r.auth`), traduction d'erreurs en un seul `catch`. |
| **Exception Translation** | `application/errors.js` + `bad()` | `ApplicationError(status)` traduit en réponse HTTP à un seul endroit. |
| **Registry / Plugin** | `web/src/app/registry.js` | 13 fonctionnalités `{pages, actions, …}` fusionnées ; **un doublon de clé lève une erreur au chargement** (garde-fou). |
| **Event delegation + dispatch par `data-*`** | `web/src/app/router.js` | 4 écouteurs sur la racine pour tout l'écran ; aucun écouteur par bouton. |
| **Anti-Corruption Layer (Mapper)** | `web/src/core/mapping.js` | le format de l'API (`sujet`, `niveau_utile`…) n'entre jamais dans les vues : traduit en modèle d'écran. |
| **Gateway** | `assistant/adapters/workerChatGateway.js`, `ingestion/adapters/outbound/http/httpRagGateway.js` | `fetch` isolé derrière une interface ; injectable (tests). |
| **Facade + Factory** | `core/api.js` (`createApi({fetchFn, getBaseUrl})` + instance `api`) | un point d'accès au Worker, jeton et délai d'attente centralisés. |
| **Template Method (enveloppe d'écriture)** | `core/remote.js` `mutate(fn, render, {after, errKey})` | séquence unique : verrou anti double-envoi → appel → rechargement → gestion 401 → rendu. |
| **Domaine front pur** | `features/*/domain/*.js` | aucun import (ni DOM, ni état) : vérifié automatiquement (règle F1). |

## 3. Violations trouvées et **corrigées**
| # | Violation | Correction |
|---|---|---|
| 1 | `apiHandler` (adaptateur **entrant**) importait `NODE_TYPES` depuis `d1Repository` (adaptateur **sortant**) — un niveau d'arborescence est une connaissance **métier**, pas SQL. | `NODE_TYPES` déplacé dans `domain/tree.js`. |
| 2 | La racine de composition exécutait du SQL (`db.prepare('SELECT id FROM projet')` dans `retention()`). | Méthode `repo.projectIds()`. |
| 3 | `documents` dépendait de `integration/uploader` (fonctionnalité → fonctionnalité). | Code partagé placé dans `ingestion-screen/upload.js` (couche de liaison avec le module d'ingestion). |
| 4 | Découverte par le script : `projects` importait directement le lecteur Excel du module d'ingestion. | Passe par `ingestion-screen/upload.js` (`readSheetRows`). |

**Règles désormais imposées par la CI** (`npm run check`, point de contrôle ①) : W1 domaine pur · W2 application sans adaptateurs · W3 entrant sans sortant · W4 sortant sans entrant ni composition · F1 domaine front pur · F2 noyau sans fonctionnalités · F3 pas de dépendance entre fonctionnalités (3 liaisons déclarées, toutes vers le pipeline documentaire) · F4 une vue n'importe pas les actions. Un test dégrade volontairement une copie du dépôt pour prouver que **chaque règle détecte sa violation**.

## 4. Écarts restants (non traités : refontes plus larges, à décider)
| Prio | Constat | Pourquoi c'est un problème | Recommandation | Effort |
|---|---|---|---|---|
| **1** | **`apiHandler.js` = « Transaction Script » de 379 lignes** : les règles métier (niveaux d'évaluation, motifs, statuts de suivi, politique de mot de passe, dernier administrateur, durée minimale de conservation) vivent dans l'adaptateur HTTP ; il n'existe **aucune couche cas d'usage pour `/api`** (alors que le RAG en a une). | Règles non réutilisables hors HTTP, testables seulement via le routeur ; l'adaptateur connaît le métier. *(J'ai moi-même ajouté une partie de ces règles à cet endroit.)* | Extraire des cas d'usage (`rateAnswer`, `changePassword`, `anonymiseUser`, `followUpSignal`…) ; l'adaptateur ne garde que HTTP ↔ cas d'usage. | Moyen |
| **2** | **`d1Repository.js` = « God Repository »** : 52 méthodes pour 7 agrégats (comptes, arborescence, documents, connaissances, comptes rendus, conversations, indicateurs) ; **aucun port déclaré** pour lui ni pour le chiffrement (`ports/index.js` n'en contient pas). | Viole la ségrégation des interfaces ; impossible de substituer ou de simuler une partie. | Découper par agrégat + déclarer les ports ; isoler `indicators()` en requête de lecture dédiée (CQRS léger). | Moyen |
| **3** | **État global mutable** `S` importé par **34 modules** ; les actions le modifient directement, les vues le lisent (dépendance cachée), re-rendu intégral par `innerHTML`, aucun mécanisme d'abonnement. | Couplage implicite ; les tests doivent simuler `localStorage`, `document`, `location` globaux. | Acceptable à cette taille : pas de refonte. Si l'application grossit : petit magasin avec `subscribe` + rendu ciblé. | Faible (surveiller) |
| **4** | **Connaissance dupliquée** : les 4 niveaux d'arborescence sont écrits à 5 endroits (`domain/tree.js`, `d1Repository`, `web/core/referentials.js`, `web/core/treeImport.js`, `projects/view.js`), de même que les statuts (`'attente'`, `'À analyser'`…) en littéraux (« primitive obsession »). | Un changement oublié quelque part = bug silencieux. | Une constante par côté (worker : dériver de `tree.js` ; front : réutiliser `referentials.js`) ; objets énumérés pour les statuts. | Faible |
| **5** | **Port « confirmation » appliqué à moitié** : le module d'ingestion a un port + adaptateur (`windowConfirmer`), mais 5 appels `confirm()` directs ailleurs, chacun avec sa garde `typeof confirm === 'function'`. | Incohérence ; garde dupliquée. | `core/confirm.js` unique, injectable. | Faible |
| **6** | **Données de démonstration dans le code de production** : `core/seeds` et `answerWith` sont embarqués ; `D()` retombe sur `SEEDS` pour les identifiants `lyon`/`grenoble` tant que le projet n'est pas chargé. | Risque d'afficher de fausses données si le chargement échoue. | Retomber sur `EMPTY` (Null Object) partout ; réserver les seeds aux tests. | Faible |
| **7** | `workerChatGateway` porte deux stratégies derrière un `if` (jeton → `/api/.../chat`, sinon route RAG historique). | Deux comportements dans un adaptateur. | À séparer le jour où la route historique sera retirée. | Négligeable |
| **8** | Mineur : `history/actions.js` importe un utilitaire (`filteredLogs`) situé dans la vue ; le 503 de `buildApp` reconstruit une réponse à la main au lieu d'utiliser `json()`. | Dépendance action → vue ; duplication. | Déplacer l'utilitaire dans `core/history.js` ; utiliser `json()`. | Négligeable |

## 5. Limites de cet audit
Les règles de dépendance sont **vérifiées automatiquement** ; la qualité des patterns (cohésion, responsabilités) est un **jugement de lecture**, non mesuré. La couverture de tests n'a pas été mesurée. L'audit ne porte pas sur la sécurité (voir `ECARTS_TRAITES.md`).
