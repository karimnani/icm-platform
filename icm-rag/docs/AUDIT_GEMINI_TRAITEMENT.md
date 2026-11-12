# Audits « coach / hostile / ultra-hostile » — vérifiés contre le code, puis traités

Légende : ✅ corrigé · ℹ️ constat **inexact ou déjà couvert** dans ce code (vérifié, rien à changer) · ◐ atténué (limite indiquée) · ⛔ non fait volontairement (raison) .
Règle suivie : **ajouts uniquement**, comportement historique inchangé tant qu'aucune option n'est activée ; les 75 tests d'origine passent sans modification, 44 tests ajoutés (`worker/tests/hardening.test.js`, `web/tests/hardening.test.js`).

## Corrigé
| Audit | Constat réel | Correctif |
|---|---|---|
| Vecteurs orphelins (« zombie ») | Réindexer un document plus court laissait ses anciens morceaux dans Vectorize | `ingestDocument` supprime les identifiants excédentaires (nombre ancien lu dans D1 : `catalog.chunkCount`) |
| Suppression > 200 morceaux | `delete`/`purge` ne retiraient que 2 × 100 identifiants | Nombre de paquets calculé d'après le catalogue (jamais moins que l'historique : 2) |
| Pas de compensation D1 ⇄ Vectorize | Échec du catalogue après `upsert` = vecteurs fantômes | Document **nouveau** : vecteurs écrits retirés puis erreur propagée. Document **existant** : rien n'est supprimé (ancienne version préservée) |
| `catch(() => {})` muet | Échec Vectorize totalement invisible | Journalisé (`console.error`), compté, et `avertissement` ajouté à la réponse **seulement en cas d'échec**. La suppression de la fiche continue (voir ⛔ ci-dessous) |
| Collision d'empreinte (48 bits) | Deux noms différents pouvaient écraser le même document | Refus **409** si l'empreinte existe déjà avec un autre titre (`catalog.titleOf`). Les identifiants existants ne changent pas |
| Injection de prompt indirecte | Extraits mêlés à la question sans consigne | Extraits balisés `<extraits>…</extraits>`, règle « données, jamais des ordres », règle anti-mélange entre documents |
| Découpage au milieu d'une ligne de tableau / phrase | Coupe franche tous les 1500 car. sur les longs paragraphes | `splitLong` : coupe sur fin de ligne, sinon fin de phrase, dans le dernier tiers de la fenêtre ; sinon coupe franche. Paragraphes courts, sections, pages : inchangés |
| `esc()` sans `'` ni `` ` `` | Évasion possible d'un attribut HTML quoté en `'` | `esc` échappe `'` et `` ` `` (l'affichage est identique) |
| Service worker | Réponses `/api/*` mises en cache ; `undefined` si hors cache ; réponses d'erreur mises en cache | `/api/` et `/ingest` jamais interceptés ; repli = réponse 503 explicite ; seules les réponses `ok` sont mises en cache |
| CORS `*` | Ouvert à tout site | **Opt-in** : variable `ALLOWED_ORIGIN` (sans elle : inchangé) |
| Supervision | Aucune sonde | `GET /api/health` (D1 + présence des liaisons + secret) : 200 / 503 |

## ℹ️ Inexact ou déjà couvert (vérifié dans le code)
* **Sessions « zombie »** : `me()` relit l'utilisateur en D1 à **chaque** appel `/api/*` et refuse `is_active = 0` (401). Rôle relu aussi à chaque appel.
* **Cloisonnement multi-projets de `/api`** : chaque route passe par `need(user, pid)` → table `affecter`. Seules les routes RAG brutes étaient ouvertes : `RAG_REQUIRE_AUTH="1"` (déjà livré, **à activer**).
* **Timing attack HMAC** : la signature est vérifiée par `crypto.subtle.verify` (temps constant). Aucune comparaison `===`.
* **PBKDF2 à 210 000 itérations** : impossible — Workers plafonne PBKDF2 à 100 000 (déjà utilisé).
* **`PRAGMA foreign_keys`** : D1 applique toujours les clés étrangères ; pas de connexion « vierge » à configurer.
* **« Je ne sais pas » en cas de panne** : le front lève une erreur sur réponse vide ; l'API renvoie **502** si le moteur échoue ; l'échec d'embedding a un message distinct.
* **Seeds affichés si D1 est en panne** : connecté, le front part d'un projet **vide** (`EMPTY`) et affiche l'erreur ; les seeds ne servent que hors connexion (mode démonstration).
* **Cache SW périmé** : `stamp-sw.mjs` estampille le cache avec le commit à chaque déploiement.
* **Verrou SQLite pendant un appel IA** : aucune transaction n'enjambe un appel IA/Vectorize (les `batch` D1 sont atomiques et courts).
* **Bindings `env.IA || env.AI`** : repli documenté, volontaire (ancien nom de liaison) ; l'état réel est désormais visible via `/api/health`.

## ◐ / ⛔ Non fait — décision à prendre, pas un oubli
| Sujet | Raison |
|---|---|
| Passer l'empreinte à 128 bits | Les identifiants servent de clé D1 **et** d'identifiant de vecteur : changer la largeur orpheline tous les documents existants. Nécessite une migration dédiée + réindexation. Atténué par le refus 409 ci-dessus |
| Abandonner la suppression de fiche si Vectorize échoue | Je n'ai pas pu vérifier hors ligne que `deleteByIds` ignore sans erreur les identifiants inexistants (la purge en sonde ~200) ; abandonner pourrait rendre des documents impossibles à supprimer. À trancher après un essai réel |
| Rejeter un document sans nom (422) | Changerait le contrat de `/ingest` ; le front envoie toujours un nom |
| Recherche hybride FTS5 / BM25 | Les textes des morceaux ne sont que dans Vectorize ; il faut une table de morceaux en D1 + migration + réindexation |
| Outbox hors-ligne (IndexedDB), Lamport/CRDT, nœud local, Queues/R2, WASM | Chantiers d'architecture, non testables ici sans navigateur/infra réelle ; risque élevé de régression |
| Découpage de `d1Repository` / `apiHandler`, enums partagés, morphdom | Refactorings larges déjà documentés (AUDIT_DESIGN_PATTERNS.md) ; faits sans filet navigateur, ils risqueraient de casser l'existant |
| Limitation de débit IA, limite 50 sous-requêtes (plan gratuit), taille max côté serveur | Dépend du plan Cloudflare et d'une liaison à créer ; un refus automatique casserait des usages valides sur plan payant |
| SRI sur SheetJS/Mammoth, `Object.freeze(Object.prototype)` | Empreintes non calculables hors ligne ; le gel du prototype casse des bibliothèques tierces |
| Linter de saisie, masquage RGPD à la frappe, confirmation « dry-run » | Évolutions fonctionnelles à valider avec les utilisateurs, pas des correctifs |

## Contre-audit de ce lot (défauts trouvés dans mes propres correctifs, corrigés)
1. **Régression service worker** : l'exclusion `startsWith('/ingest')` interceptait aussi `/ingest.html` (page listée dans le cache hors-ligne) → désormais égalité stricte `=== '/ingest'` ; test `web/tests/sw.test.js`.
2. **Évasion du délimiteur de prompt** : un document contenant `</extraits>` pouvait refermer le bloc de données → balises retirées du contenu des extraits.
3. **Refus 409 après calcul d'embeddings** (quota gaspillé) → garde-fou déplacé avant tout calcul IA.
Risques résiduels connus : voir la réponse d'audit (course entre deux ingestions simultanées du même nouveau document, `/api/health` public, absence de validation d'ordre D1/Vectorize sans transaction réelle).
