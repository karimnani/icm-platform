# Gestion des exceptions et résilience

Principe : **une panne passagère est absorbée, une panne durable est dite clairement, une erreur n'est jamais transformée en fausse réponse.** Les contrats HTTP existants sont conservés ; seuls des champs (`ref`, `avertissement`) et des statuts plus précis (503) s'ajoutent.

## Worker
| Couche | Mécanisme | Détail |
|---|---|---|
| `application/services/resilience.js` | `withTimeout`, `withRetry`, `isTransient`, `classifyInfraError`, `refId`, `purgeAllProjects` | Briques pures et testées |
| Embedding, Vectorize | Délai (30 s / 20 s) + **1 reprise** sur panne passagère | Opérations idempotentes (identifiants déterministes) |
| LLM | Délai (50 s), **pas de reprise** | Une reprise doublerait la consommation de quota |
| Convertisseur de documents | Panne inattendue → **502** lisible | Le 422 « PDF illisible » est conservé |
| Ingestion | Empreintes incomplètes → **502**, rien n'est écrit | Avant : vecteurs « undefined » possibles |
| Question | Sortie vide du modèle → **502** | Avant : réponse vide enregistrée en base |
| Routeur RAG et API | Erreur inattendue → **ref** de suivi (journal ⇄ message), **503** si transitoire ou quota IA, 500 générique sinon | Message d'erreur du routeur RAG conservé |
| Point d'entrée | Filet global : jamais d'erreur 1101 brute ; JSON + CORS + `ref` | Idem pour la tâche planifiée |
| Purge RGPD planifiée | Un projet en échec n'arrête plus les suivants | Échecs journalisés |
| `/api/health` | Délai de 1,5 s sur la sonde D1 | |

## Front
| Point | Mécanisme |
|---|---|
| Client API | Lecture (GET) retentée **une fois** (coupure, 502/503/504). **Écriture jamais retentée** (pas de doublon d'intervention). Délai dépassé, 4xx : pas de reprise. Hors ligne détecté : message clair, aucun envoi |
| Rendu | Un écran qui plante affiche un repli récupérable (lien de rechargement) au lieu de figer l'application |
| Gestionnaires d'événements | Exception synchrone ou promesse rejetée → bandeau d'erreur, indicateur « enregistrement en cours » débloqué |
| Démarrage | La reprise de session ne peut plus empêcher l'affichage |
| Filet global | `error` / `unhandledrejection` → bannière hors de l'écran applicatif (la saisie en cours n'est pas effacée) |

## Limites assumées
* **Pas de reprise sur les écritures D1** : la reprise d'une écriture dont le résultat est incertain (délai) pourrait la dupliquer. Une panne D1 passagère est donc signalée (503 + `ref`) mais pas masquée.
* Un délai n'annule pas l'appel Cloudflare sous-jacent (non exposé par le runtime) : il libère seulement la requête.
* Les reprises consomment des sous-requêtes (plafond du plan gratuit : 50) ; elles ne se déclenchent que sur panne passagère.
* Pas de saisie hors ligne (file IndexedDB), de coupe-circuit ni de repli vers un autre fournisseur d'IA : chantiers distincts, voir `AUDIT_GEMINI_TRAITEMENT.md`.
