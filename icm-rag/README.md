# ICM · Gestion documentaire RAG — architecture hexagonale

Deux applications indépendantes, même découpage :

```
worker/  (Cloudflare Worker : Workers AI + Vectorize + Firebase RTDB)
  src/
    index.js                      point d'entrée Cloudflare (3 lignes)
    composition/buildApp.js       RACINE DE COMPOSITION : seul fichier qui câble tout
    config/constants.js           modèles, seuils, URL Firebase, documents legacy
    domain/                       logique PURE (aucun import externe, aucune I/O)
      text/        chunker.js, identifiers.js (clean, slug, shortHash)
      document/    vectorIds.js, documentRecords.js
      rag/         answerPolicy.js (prompt système, messages, contexte, sources)
    application/                  CAS D'USAGE + PORTS (dépend du domaine uniquement)
      ports/index.js              contrats : Embedding, Llm, DocumentConverter, VectorStore, Catalog
      use-cases/                  ingestDocument, listDocuments, deleteDocument, purgeProject, askQuestion
      services/vectorCleanup.js
      errors.js                   ApplicationError(message, status)
    adapters/
      inbound/http/               router.js, handlers.js, responses.js (CORS/JSON)
      outbound/cloudflare/        workersAiEmbedder, workersAiLlm, workersAiConverter, vectorizeStore
      outbound/firebase/          firebaseCatalog.js
  tests/                          node --test (domaine + cas d'usage avec faux adaptateurs)

web/  (dossier déployé sur Cloudflare Pages — icm-app)
  index.html                      coquille de l'application (une <div id="root"> et <script type="module" src="src/main.js">)
  css/app.css                     styles de l'application  ·  css/ingest-standalone.css  styles de ingest.html
  ingest.html                     page autonome d'ingestion (test / back-office)
  manifest.json, sw.js            PWA (sw.js : liste de fichiers à jour avec tous les modules)
  src/
    main.js                       point d'entrée : branche le routeur, le ticker, premier rendu
    app/                          registry.js  assemble les fonctionnalités (détecte les doublons)
                                  render.js    écran courant (droits d'accès) + rendu
                                  router.js    événements click / submit / input / change / hashchange
    core/                         partagé : state.js (S), projectData.js (D, données par projet),
                                  tree.js, navigation.js (MENU, ACCESS, shell), session.js, history.js,
                                  format.js, icons.js, referentials.js, config.js (adresse du Worker), seeds/
    features/                     UN DOSSIER PAR ÉCRAN : view.js (HTML) + actions.js (gestionnaires) + index.js
      auth/ projects/ assistant/ documents/ interventions/ integration/
      ingestion-screen/ validation/ history/ accounts/ connectors/
      assistant/                  Assistant IA branché sur le Worker (voir ci-dessous)
        domain/chatReply.js         pur : réponse du Worker → message, libellé des sources, erreurs
        adapters/workerChatGateway.js   POST <Worker>/ {action:'chat', question, project}
        conversation.js             logique : attente, réponse, erreur, « Réessayer », une question à la fois
      ingestion/                  MODULE INTÉGRABLE « Ingestion RAG » : mountIngestion(root, {getBaseUrl, getProject, allowPurge})
    standalone/ingest-main.js     branche ingest.html sur le module
  tests/                          npm test (domaine, Assistant, contrat avec le vrai routeur du Worker)
```

## Assistant IA : fonctionnement
- Chaque question part au Worker (`POST /`, `{ action: 'chat', question, project }`) ; `project` est le projet actif du menu.
  Un document ingéré sous `lyon` n'est donc retrouvé que si l'Assistant est sur le projet `lyon`.
- L'adresse du Worker est **la même** que celle de l'écran « Ingestion RAG (serveur) » (`core/config.js` : valeur par défaut `WORKER_URL_DEFAULT`,
  remplacée par la valeur saisie dans l'écran, mémorisée dans `localStorage`). Le Technicien n'a pas accès à cet écran : il utilise la valeur par défaut
  (ou celle déjà mémorisée dans son navigateur). **Corrigez `WORKER_URL_DEFAULT` si l'adresse de votre Worker diffère.**
- Pendant la requête : bulle « Recherche dans les documents du projet… », bouton Envoyer bloqué (une question à la fois).
  En cas d'échec (réseau, délai de 60 s, erreur du Worker) : message explicite et bouton « Réessayer » ; aucune fausse réponse n'est jamais affichée.
- Sources : le Worker renvoie le titre de **section** (pas de numéro de page) → affiché « section « … » » ; une source est un lien vers la fiche
  documentaire seulement si le document existe dans le catalogue de l'application, sinon simple texte.
- Les conversations d'exemple (historique) et les questions proposées restent des données de démonstration ; les nouvelles questions sont réelles.

## Ajouter ou modifier un écran
1. Créer `src/features/<ecran>/` : `view.js` (`export const pages = { <id>: () => shell('<id>', ...) }`), `actions.js` (tables `actions`, `submits`,
   `inputs`, `changes`… ; un gestionnaire reçoit `{ e, b, v, d, t, i, render }` et peut renvoyer `false` pour éviter le rendu qui suit), `index.js`
   (`export const feature = { pages, actions, ... }`).
2. L'ajouter à la liste `FEATURES` de `src/app/registry.js` et au `MENU` de `src/core/navigation.js` (rôles autorisés).
3. Ajouter les nouveaux fichiers à `FILES` de `sw.js`.
Deux écrans ne peuvent pas définir la même clé (`data-act`, `data-input`…) : `registry.js` lève une erreur au chargement.

> `index.html` charge des modules ES : l'ouvrir par double-clic (`file://`) ne fonctionne plus. En local : `npx serve web` (ou `npx wrangler pages dev web`).

## Règle de dépendance
`adapters → application → domain`. Le domaine n'importe rien ; l'application ne connaît que les **ports** ;
seuls `composition/` et les `adapters/` connaissent Cloudflare, Firebase, le DOM, mammoth ou SheetJS.

## Recettes d'évolution
- **Changer de LLM / d'embedding** : modifier `config/constants.js` ou écrire un nouvel adaptateur `LlmPort`/`EmbeddingPort`, puis le brancher dans `buildApp.js`.
- **Remplacer Firebase** (Supabase, D1, KV…) : implémenter `CatalogPort` dans `adapters/outbound/<techno>/` et changer une ligne dans `buildApp.js`.
- **Nouvelle route** : use case dans `application/use-cases/`, handler dans `handlers.js`, ligne dans `router.js`.
- **Nouveau format de fichier (front)** : un lecteur dans `adapters/outbound/browser/`, un `if` dans `ingestFile.js`, une constante dans `domain/fileFormats.js`.
- **Tester** : `cd worker && npm test` (aucun service externe requis).

## Mise en place
- Worker : `cd worker && npm i && npx wrangler deploy`. Gardez votre `wrangler.toml` actuel (seul `main = "src/index.js"` change ; liaisons : `AI`/`IA`, `VECTORIZE`). `wrangler.toml` fourni = modèle.
- Web (Pages) : `npx wrangler pages deploy web --project-name=icm-app` (ajoutez `icon-512.png` à la racine de `web/`).
- Page autonome : `https://icm-app.pages.dev/ingest.html`.
- Tests : `cd worker && npm test` ; `cd web && npm test`.

## Écarts volontaires (comportement fonctionnel identique)
1. Tableau des documents : noms échappés (HTML) et bouton Supprimer via `data-doc` + délégation d'événement (au lieu de `onclick` inline / `window.deleteDoc`).
2. Les titres de sections du module n'ont plus de numéro (« 2. », « 3. »…) car il s'insère dans un écran existant.
3. `sw.js` = votre fichier d'origine, seule la liste `FILES` est complétée avec les fichiers du module.


## Base de données D1 (relationnel) — branchement front ⇄ Worker ⇄ D1
```
Navigateur ──fetch /api/*  (Authorization: Bearer <jeton>)──▶ Worker ──▶ D1 (users, arborescence, documents, rapports, connaissances, journal)
           ──POST /ingest /list /delete /purge /  (RAG)────▶ Worker ──▶ Workers AI + Vectorize, catalogue des documents = D1
```
**Mise en place (une seule fois)**
1. `wrangler.toml` : liaison `[[d1_databases]] binding = "DB"` (l'ancien nom `icm_database` fonctionne aussi).
2. `cd worker && npx wrangler d1 execute icm-database --remote --file=migrations/0002_catalogue_columns.sql` (ajoute `chunks`/`chars` à `document_version`).
3. `npx wrangler d1 execute icm-database --remote --file=seed.sql` (projets `lyon`/`grenoble`, 9 types de documents, 4 comptes de démo — mot de passe `Changeme!2026`, **à changer**).
4. `npx wrangler secret put AUTH_SECRET` (chaîne aléatoire longue ; signe les jetons de session, durée 12 h).
5. `npx wrangler deploy` puis `npx wrangler pages deploy web --project-name=icm-app`.
Corrigez `WORKER_URL_DEFAULT` (`web/src/core/config.js`) si l'adresse de votre Worker diffère.

**Ce qui est branché** : connexion (PBKDF2 + jeton signé, rôle = table `affecter`), projets, arborescence (Site › Atelier › Ligne › Machine),
interventions (`rapport`, référence `INT-xxxx` attribuée par le serveur), validation des connaissances (`connaissance` + `decision`),
versions et rattachement des documents, comptes et droits, historique et journal (`log`). L'ingestion RAG écrit désormais ses fiches dans
`document` / `document_version` (Firebase n'est utilisé que si aucune base D1 n'est liée).
**Pas encore branché** : conversations de l'Assistant (`discussion`, `message`, `citation`, `note`), indicateurs de la page Historique, fichiers simulés de l'écran « Intégration documentaire ».

Code : `worker/src/adapters/outbound/d1/` (SQL), `adapters/inbound/http/apiHandler.js` (routes `/api/*`), `web/src/core/{api,remote,mapping}.js`.
Tests : `worker/tests/api.test.js` et `web/tests/remote.test.js` exécutent le vrai SQL (SQLite en mémoire imitant D1).


## Pilotage, gouvernance, RGPD (v suivante)
Voir **`docs/ECARTS_TRAITES.md`** (état de chaque écart du double scan, limites et décisions à arbitrer).

**Mise à jour d'une base D1 existante** (une seule fois) : `npx wrangler d1 execute icm-database --remote --file=migrations/0003_pilotage.sql`
(installation neuve : `schema.sql` contient déjà tout). Puis `npx wrangler deploy` et `npx wrangler pages deploy web --project-name=icm-app`.

**Nouveaux écrans** : *Indicateurs de pilotage* (admin) · *Mon compte* (mot de passe, export de ses données) · Assistant avec périmètre par équipement · fiche document (supprimer, type/rattachement, nouvelle version avec fichier) · Intégration documentaire réelle · import Excel/CSV de l'arborescence.
**Nouvelles routes `/api`** : `POST projets/:pid/chat` · `GET projets/:pid/discussions` · `POST projets/:pid/messages/:mid/note` · `PATCH projets/:pid/notes/:nid` · `GET projets/:pid/indicateurs` · `POST projets/:pid/recherche` · `DELETE projets/:pid/documents/:did` · `POST projets/:pid/users/:uid/anonymiser` · `POST projets/:pid/conversations/purge` · `POST me/password` · `GET me/export`.
**Options Worker (désactivées par défaut)** : `RAG_REQUIRE_AUTH="1"` (connexion exigée sur les routes RAG) · cron + `RETENTION_DAYS` (purge quotidienne des conversations) — voir `wrangler.toml`.
**Contrat modifié** : le rejet d'une connaissance exige un motif (422 sinon).


## Mise à jour continue (GitHub Actions)
`git push` sur `main` → CI → validation humaine → migrations D1 → Worker → Pages → test de fumée (retour arrière auto du Worker). Mise en place et fonctionnement : **`docs/PIPELINE.md`**. Contrôle local avant de pousser : `npm test` à la racine du dossier `icm-rag`.
