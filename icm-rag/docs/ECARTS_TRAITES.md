# Double scan 360° — suite donnée, écart par écart

Légende : ✅ traité · ◐ partiel (limite indiquée) · ⛔ non traité volontairement (raison) · ℹ️ écart de l'audit déjà couvert / non applicable à ce code

Vérification : `cd worker && npm test` (36 tests) · `cd web && npm test` (31 tests). Les 42 tests d'origine ont été rejoués **sans modification** sur le nouveau code : 41 passent ; le 42ᵉ (`api.test.js`, validation) a été **adapté sur 3 lignes** car il validait le rejet d'une connaissance sans motif — voir n°7.

## P0
| # | Écart | Statut | Ce qui a été fait |
|---|---|---|---|
| 1 | Page Indicateurs absente | ✅ | Écran admin **Indicateurs de pilotage** (`#indicateurs`) alimenté par `GET /api/projets/:pid/indicateurs?per=7\|30\|90\|all` : volume de questions, taux de satisfaction, taux d'évaluation, « Je ne sais pas », motifs d'insatisfaction, sources les plus citées, qualification brut/indexé/validé (+ % validé), connaissances capitalisées, durée moyenne d'intervention (repère MTTR). |
| 2 | Feedback / conversations non persistés | ✅ | `POST /api/projets/:pid/chat` (réponse **+** enregistrement discussion/message/citation), `GET …/discussions`, `POST …/messages/:mid/note`. L'historique des conversations et les évaluations survivent au rechargement. L'enregistrement ne peut jamais faire perdre une réponse (échec d'écriture → réponse livrée quand même). |
| 3 | Boucle de feedback non bouclée | ✅ | File « Réponses signalées » (filtre *À analyser*), `PATCH …/notes/:nid` : *Corrigé* (description de la correction obligatoire) / *Sans suite* / *Rouvrir*, traité par + date, tracé dans l'historique. |
| 4 | Citations « + page » | ◐ | Les citations sont enregistrées avec **section** (colonne `citation.section`) et la page est **propagée de bout en bout** (chunker → Vectorize → source → citation → UI) **dès que le texte converti contient des sauts de page (`\f`)**. Sans eux, comportement inchangé (section seule). Le convertisseur `ai.toMarkdown` ne garantit pas ces sauts : la pagination fiable reste un **chantier d'architecture (OCR avec pages) à chiffrer séparément**. |
| 5 | RAG sans filtre équipement | ✅ | Sélecteur « Périmètre de la recherche » dans l'Assistant ; périmètre = équipement + ses ancêtres + ses descendants + documents non rattachés. Filtrage **après** requête Vectorize (sur-échantillonnage à 20) : aucune ré-indexation nécessaire. Sans périmètre : comportement strictement historique. |

## P1
| # | Écart | Statut | Ce qui a été fait |
|---|---|---|---|
| 6 | Cascade silencieuse des rapports | ◐ | `schema.sql` : `rapport.machine_id` → `ON DELETE RESTRICT`. L'API refusait déjà (409) toute suppression d'un nœud portant des rapports (l'audit visait la maquette). **Bases existantes** : SQLite ne permet pas de modifier la clé étrangère sans reconstruire la table ; la protection API reste active et aucune autre voie ne supprime de machine. |
| 7 | Rejet sans motif | ✅ | Le bouton *Rejeter* ouvre une saisie de motif **obligatoire** ; le serveur refuse (422) un rejet sans motif ; le motif apparaît dans l'historique du statut et le journal. **Seul changement de contrat de l'API** (un appel qui passait avant est maintenant refusé). |
| 8 | Actions d'admin non tracées | ✅/ℹ️ | Changement de rôle et (dés)activation étaient **déjà** journalisés et le dernier admin déjà protégé. Ajoutés : **accès refusés** tracés (catégorie cybersécurité, statut Échec), **auto-désactivation interdite**. |
| 9 | RGPD | ✅ | Export des données (`GET /api/me/export`, hash jamais exporté), anonymisation d'un compte désactivé (`POST …/users/:uid/anonymiser`), purge des conversations (manuelle depuis *Comptes*, ou quotidienne via cron optionnel `RETENTION_DAYS`, min. 30 j ; les évaluations « À analyser » sont conservées), mention à la connexion, changement de mot de passe avec politique (≥ 10 car., lettre + chiffre). |
| 10 | Intégration sans gestion d'erreur | ✅ | « Intégration documentaire » = **téléversement réel** (glisser-déposer / parcourir) avec états *En attente · Lecture-indexation · Indexé · Échec* + message du serveur, *Réessayer*, *Retirer*, refus avant envoi (format, > 50 Mo, doublon). Plus de progression simulée pour les vrais fichiers. |
| 11 | Pas de gestion documentaire | ✅ | Fiche : *Supprimer* (fiche + vecteurs + connaissances, confirmation, tracé), *Type et rattachement* modifiables. *Nouvelle version* peut maintenant joindre un **fichier réellement relu et indexé** (sans fichier : comportement d'avant). |

## P2
| # | Écart | Statut | Note |
|---|---|---|---|
| 12 | Rattachement mono-nœud vs schéma | ⛔ | **Décision métier** : le code écrit un seul niveau à la fois (cohérent avec « un nœud = un périmètre »). À trancher avec le commanditaire ; aucune modification pour ne rien casser. |
| 13 | Templates d'arborescence | ⛔ | Le produit et le schéma D1 imposent 4 niveaux fixes (texte de l'écran : « les quatre niveaux sont obligatoires »). Contradiction CDC à arbitrer, pas un bug. |
| 14 | Technicien multi-projets | ✅ | Sélecteur de projet pour tout utilisateur ayant plus d'un projet. |
| 15 | Données codées en dur | ✅/◐ | « Mes interventions » = l'utilisateur connecté ; import Excel/CSV **réel** (en-tête reconnu, cellules fusionnées, erreurs avec n° de ligne) + modèle téléchargeable. L'analyse IA des interventions reste une vérification de saisie côté client (voir contradiction C). |
| 16 | `LEVEL_EX` Ligne | ℹ️ | Déjà présent dans ce code (défaut propre à la maquette V3). |
| 17 | Boutons morts | ✅ | Export CSV du journal réel ; modèle d'import réel ; test GMAO **honnête** (valide la saisie et indique qu'aucun connecteur n'est actif — ne simule plus « Connexion réussie ») ; cases de synchro et configuration mémorisées ; Télécharger / Consulter / pagination d'aperçu : désactivés avec explication (l'original n'est pas conservé — stockage R2 = chantier). |
| 18 | Recherche « full-text + sémantique » | ✅ | Bouton « Chercher dans le contenu » : passages scorés, périmètre respecté (`POST …/recherche`). |
| 19 | États de chargement | ◐ | Bandeau « Enregistrement en cours… » sur toute écriture + **une écriture à la fois** (anti double-clic). Assistant : déjà en place. |
| 20 | Multi-projet non arbitré | ⛔ | Décision de gouvernance, documentée ci-dessous. |

## P3
Validation : filtre statut + recherche + « Afficher plus » ✅ · page affichée seulement si connue ✅ · qualification consolidée → Indicateurs ✅ · MTTR → repère dans Indicateurs ◐ · « Se souvenir de moi » (sans effet) retiré ✅ · confirmation avant suppression d'arborescence ✅ · mise en page tablette : bandeau latéral pleine largeur < 900 px ◐ (ergonomie gants/atelier non validée) · archivage de projet, sauvegarde/restauration ⛔ (hors périmètre).

## Contradictions CDC à remonter (inchangées)
A. GMAO : hors périmètre §5.2 / nice-to-have §7.2 mais Must Have §7.1 et critère §11.1. · B. Création de projet : « 2ᵉ semestre » §7.1 vs besoin principal Admin §4 (déjà livrée). · C. Analyse IA des interventions : hors semestre §5.1 vs Must Have §7.1. · D. Suggestions de questions : Must (simples) vs Nice (contextuelles) sans frontière.

## Hors audit, constaté à la lecture (traité)
* **Routes RAG ouvertes** : `/ingest`, `/delete`, `/purge`, `/list` et le chat n'exigeaient aucune authentification (n'importe qui connaissant l'URL pouvait purger la base vectorielle). Ajout d'un contrôle **opt-in** `RAG_REQUIRE_AUTH="1"` (jeton + rôle du projet, Admin pour écrire/supprimer). **Désactivé par défaut** → aucun changement tant que vous ne l'activez pas. À activer avant la mise en production.
* Mots de passe du `seed.sql` (`Changeme!2026`) : à changer avant toute exposition.
* `CORS: *` conservé (inchangé) : à restreindre au domaine Pages en production.
