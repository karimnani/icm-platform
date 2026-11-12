# Pipeline de mise à jour continue (GitHub Actions → Cloudflare)

Un `git push` sur `main` met l'application à jour en quelques minutes : **base D1 → Worker → application (Pages)**, après cinq points de contrôle, avec retour arrière automatique du Worker si l'application déployée ne répond pas correctement.

```
 PR / branche ──► ① CI ───────────────► (bloque la fusion si rouge)
 push main ─────► ① CI ► ② Préparation ► ③ Validation humaine ► ④ Migrations ► Worker ► Pages ► ⑤ Test de fumée
                                                                                         └─ échec ⇒ retour arrière Worker
```

| Point de contrôle | Ce qui est vérifié | Bloque si |
|---|---|---|
| ① CI — architecture (`scripts/check-architecture.mjs`) | règles de dépendance entre couches (Worker hexagonal, noyau et fonctionnalités du front) — voir `AUDIT_DESIGN_PATTERNS.md` | une couche importe ce qu'elle ne doit pas |
| ① CI — cohérence (`scripts/check-repo.mjs`) | tout fichier listé par `sw.js` existe et tout module y figure · icônes du manifest · numérotation des migrations · aucun secret en clair · liaisons `wrangler.toml` | PWA cassée, migration en double, secret commité |
| ① CI — tests | Worker (36 tests : API, RAG, SQL réel), Front (31), Pipeline (8 : migrations, smoke, estampillage, architecture) | un seul test rouge |
| ② Préparation | secrets/variables présents · **périmètre réel** (Worker et/ou Pages modifiés ?) · **simulation des migrations** en attente (rien n'est écrit) · récapitulatif pour le relecteur | configuration incomplète |
| ③ Validation humaine | environnement GitHub `production` avec relecteurs obligatoires | refus / absence d'approbation |
| ④ Déploiement | migrations suivies (`_migrations`) → Worker → cache PWA estampillé avec le commit → Pages. Seul ce qui a changé est déployé | échec Cloudflare |
| ⑤ Test de fumée (`scripts/smoke.mjs`, 3 tentatives) | Worker vivant · `AUTH_SECRET`/D1 configurés · mauvais identifiants refusés · CORS · page, modules, icône · **le service worker servi porte bien le commit déployé** · avec compte de contrôle : projet, **indicateurs et conversations (prouve que le SQL est à jour)** | tout échec ⇒ retour arrière du Worker |

## 1. Mise en place (une seule fois)

1. **Dépôt GitHub** : la racine du dépôt est le dossier `icm-rag-d1/` du zip (`.github/` s'y trouve). Si votre dépôt est le dossier `icm-rag` lui-même, déplacez `.github/` à la racine et mettez `APP_DIR: .` dans les 3 workflows.
2. **Jeton Cloudflare** (My Profile → API Tokens) avec les droits *Workers Scripts : Edit*, *D1 : Edit*, *Cloudflare Pages : Edit*, *Workers AI : Read*, *Vectorize : Edit* (si un message d'erreur cite un droit manquant, ajoutez-le).
3. **Secrets** (Settings → Secrets and variables → Actions → *Secrets*) : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, et pour le contrôle SQL : `SMOKE_EMAIL`, `SMOKE_PASSWORD` — **créez un compte Administrateur dédié** au contrôle (jamais un compte de `seed.sql`, jamais un compte nominatif).
4. **Variables** (onglet *Variables*) : `WORKER_URL` (ex. `https://icm-maser.<compte>.workers.dev`), `PAGES_URL` (ex. `https://icm-app.pages.dev`), optionnelles : `PAGES_PROJECT` (défaut `icm-app`), `D1_DATABASE` (défaut `icm-database`).
5. **Environnement `production`** (Settings → Environments → New) → *Required reviewers* : ajoutez au moins une personne. C'est le point de contrôle ③. *(Sur un dépôt privé, cette fonction exige GitHub Team/Enterprise ; sinon l'étape est inopérante — utilisez alors une règle de protection de branche + Pull Request obligatoire.)*
6. **Protection de `main`** (Settings → Branches) : exiger une Pull Request et le contrôle **« CI ok »**.
7. **Une fois, hors pipeline** : créer le projet Pages (`npx wrangler pages project create icm-app`), poser le secret du Worker (`npx wrangler secret put AUTH_SECRET`) et appliquer `schema.sql` si la base est neuve. Le pipeline ne touche jamais aux secrets du Worker ni aux données de démonstration.

## 2. Mettre à jour l'application au quotidien
Branche → Pull Request (la CI tourne) → fusion dans `main` → le pipeline démarre → **approuvez** dans l'onglet *Actions* → l'URL de production est mise à jour. Le récapitulatif de l'exécution indique ce qui sera déployé et les migrations en attente.

**Ajouter un nouveau fichier de l'application** : pensez à le déclarer dans `web/sw.js` (`FILES`) ; le point ① vous le rappelle en échouant.

**Changer le schéma de la base** : ajoutez `worker/migrations/0004_<nom>.sql` (numérotation continue). Règle : **additive uniquement** (nouvelle colonne, nouvelle table, nouvel index), jamais de suppression ni de renommage — c'est ce qui permet à l'ancien Worker de continuer à tourner pendant la bascule et au retour arrière d'être sans risque. Reportez aussi le changement dans `schema.sql` (installations neuves). La première exécution sur une base dont `0002` et `0003` ont été appliquées à la main les marque simplement « baseline » sans rien casser.

## 3. Retour arrière
* **Automatique** : si ⑤ échoue, le Worker revient à sa version précédente ; les migrations (additives) restent.
* **Manuel** : *Actions → Retour arrière → Run workflow* : `ref` = commit sain pour l'application, `worker_version` = vide (version précédente), un identifiant (`npx wrangler deployments list`), ou `non`. Même validation humaine.
* Le **front** (Pages) n'a pas de retour arrière automatique : le workflow manuel redéploie le commit choisi.

## 4. Limites à connaître
* Ce pipeline a été écrit et testé **hors ligne** : scripts exécutés et testés (migrations sur SQLite réel, test de fumée contre un serveur local branché sur le vrai Worker, détection d'anomalies sur copie cassée), YAML et shell validés syntaxiquement. **Il n'a pas été exécuté sur GitHub ni contre Cloudflare** : prévoyez un premier passage surveillé. Point à confirmer en particulier : l'option `--yes` de `wrangler rollback` (version de Wrangler).
* Pas d'environnement de préproduction ni de prévisualisation par Pull Request (cela suppose une seconde base D1 et un second index Vectorize) ; le point ③ + le test de fumée en tiennent lieu.
* Le test de fumée vérifie la santé du service, pas les réponses de l'IA.
* `CORS: *`, les mots de passe de `seed.sql` et `RAG_REQUIRE_AUTH` (voir `ECARTS_TRAITES.md`) restent à traiter avant la mise en production.
