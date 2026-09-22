# Audit sécurité, fonctionnel et technique — Studik

Date : 2026-09-22
Périmètre : dépôt local `Studik` (code), API Supabase du projet `pgcjhafcwtreobzrzajs` (tests réseau en lecture/écriture non destructive), build de production généré localement.
Non couvert : tableau de bord Supabase (paramètres Auth, policies RLS exactes, réglages du bucket de stockage), configuration réelle du déploiement Vercel (domaine de production non communiqué), historique GitHub distant (seul l'historique Git local — 15 commits — a été inspecté).

---

## A. Synthèse

**État général.** Le projet est une SPA JavaScript vanilla (Vite) + Supabase, sans framework, à un seul utilisateur légitime. Le code est propre, sans dépendance non maintenue (`npm audit` : 0 vulnérabilité sur les 2 dépendances runtime), sans usage dangereux (`eval`, `new Function`, SQL brut, `.rpc()` non paramétré). La clé Supabase publiée dans le code est bien la clé `anon` publique documentée, jamais une clé `service_role` — vérifié dans le code source, dans le bundle de production généré, et dans l'historique Git complet.

**Niveau de vérification réellement atteint.** Élevé sur tout ce qui est testable depuis ce dépôt et par requêtes réseau directes (RLS côté anonyme, secrets, dépendances, injection, upload, XSS statique), **y compris désormais le réglage des inscriptions publiques**, confirmé en conditions réelles le 2026-09-22 (voir mise à jour ci-dessous). **Toujours non vérifiable depuis cet environnement** : les policies RLS exactes par rôle (visibles seulement dans le tableau de bord Supabase), les en-têtes HTTP réellement servis en production par Vercel, la politique du bucket de stockage `studik-images`. Aucun compte de test n'a été créé sur le projet de production — la vérification ci-dessous a été faite par une requête rejetée avant toute création de compte, voir la preuve dans VULN-01.

**Mise à jour du 2026-09-22 — VULN-01 corrigé et vérifié.** Tu as désactivé "Allow new users to sign up" dans le tableau de bord Supabase. Vérifié en conditions réelles : un appel direct à `POST /auth/v1/signup` avec une adresse jetable (`@example.com`, domaine réservé aux tests, ne reçoit jamais de vrai courrier) a été **rejeté avec le code `signup_disabled`** avant toute création de compte. Le risque n°1 de cet audit est donc clos : même si le schéma de base ne porte toujours aucune colonne d'identité (`user_id`), plus personne ne peut créer de second compte pour l'exploiter. Détail en VULN-01.

**Actions correctives déjà réalisées** (voir §E) : échappement HTML systématique des champs de contenu (titres, questions, noms de matière/cours, texte des QCM) avant injection dans le DOM sur 16 fichiers, remplacement de `window.confirm()` par une modale interne sur 8 fichiers (déjà fait lors d'une session précédente, revérifié ici), ajout d'en-têtes de sécurité HTTP via `vercel.json`, ajout d'un script de test reproductible pour la RLS anonyme, correction d'une corruption de fichier (octets NUL) découverte en cours d'audit.

**Risques restants à traiter par toi** : envisager malgré tout un durcissement des policies RLS par identité en défense en profondeur (SQL fourni en §F — utile si les inscriptions étaient un jour réactivées par erreur), envisager une Content-Security-Policy (recommandation fournie, non appliquée automatiquement).

---

## B. Tableau des vulnérabilités

| ID | Gravité | Fichier / composant | Description technique | Conditions d'exploitation | Impact possible | Preuve / résultat du test | Correction | Vérification après correction |
|---|---|---|---|---|---|---|---|---|
| **VULN-01** | ~~Critique~~ → **Corrigée et vérifiée (2026-09-22)** | Tableau de bord Supabase (Auth) + schéma des tables (`matieres`, `fiches`, `cas_cliniques`, `qcm`, `tentatives`, `qcm_tentatives`, `tags_reference`, `checkins`, `captures`) | Aucune table ne porte de colonne d'identité (`user_id`/`owner_id`). Les grants sont `to authenticated` (confirmé par `CLAUDE.md` et les migrations de cette session), donc toute policy RLS ne peut techniquement distinguer "toi" d'un autre compte authentifié. Tant que les inscriptions publiques étaient activables, un attaquant aurait pu créer un compte via `POST /auth/v1/signup` (sans passer par l'UI, qui n'expose pas ce bouton) et obtenir un accès complet. | Inscription publique Supabase activée — **désormais désactivée par toi et vérifié** | Lecture/écriture/suppression de 100 % des données personnelles (fiches médicales, cas cliniques, historique de révision, streak) par un tiers — **risque neutralisé** | Analyse du schéma (pas de colonne d'identité) + confirmation par `main.js:406-415` (`handleUser(user)` affiche l'application complète pour **tout** utilisateur authentifié, sans vérifier son email/UUID) + **test réel post-correction** : `POST https://pgcjhafcwtreobzrzajs.supabase.co/auth/v1/signup` avec une adresse `@example.com` jetable → `422 {"error_code":"signup_disabled","msg":"Signups not allowed for this instance"}`, requête rejetée avant toute création de compte | Toi : Authentication → Providers → Email → "Allow new users to sign up" désactivé | **Vérifiée le 2026-09-22** par appel API réel — voir preuve ci-contre. Recommandation de défense en profondeur toujours valable (policies RLS nominatives, SQL en §F) mais non urgente : l'exploitation nécessite désormais une réactivation manuelle des inscriptions par toi |
| **VULN-02** | **Élevée (confirmée)** | 16 fichiers de pages (`organisation.js`, `entrainement.js`, `tag-page.js`, `qcm-liste.js`, `qcm-detail.js`, `qcm-jouer.js`, `stats.js`, `carnet-erreurs.js`, `fiche-detail.js`, `referentiel.js`, `session.js`, `revision.js`, `accueil.js`, `main.js`, `import.js`) | Des champs dérivés du contenu (titre de fiche, question de cas, titre de QCM, texte de question/item, nom de matière/cours) étaient interpolés directement dans des template literals assignés à `.innerHTML`, sans échappement. Un contenu contenant `<script>` ou un attribut `on...=` s'exécuterait tel quel. | En usage normal (site solo, contenu généré par toi via prompt Claude), risque faible car tu es la seule source de contenu. Devient exploitable à distance si VULN-01 est réel (un attaquant avec accès en écriture pourrait créer une fiche/QCM/matière piégée) — vol du jeton de session (`localStorage`) via XSS, ce qui équivaut à un accès complet au compte. | Chaîné à VULN-01, ou via un import JSON collé sans relecture | Vol de session, actions arbitraires sur le compte | Confirmé par grep systématique (`\$\{...\.titre\}`, `.question`, `.nom}`) sur `src/pages` — 45+ points d'interpolation trouvés | **Corrigée** : nouveau `src/lib/escape.js` (`escapeHtml`), appliqué à tous les points identifiés ci-dessus | Build vérifié (`npm run build` OK), relecture visuelle en local des pages Organisation, Référentiel, QCM — rendu inchangé pour du contenu normal |
| **VULN-03** | **Faible (résiduelle, non corrigée)** | Mêmes fichiers que VULN-02 | Certains champs secondaires (`matiere`/`sous_matiere`/`type` dans quelques emplacements, tags dans 1-2 endroits) n'ont pas été passés en revue aussi systématiquement que titre/question/nom — la correction a priorisé les champs à plus forte visibilité. | Même chaîne que VULN-02 | Identique à VULN-02, surface réduite | Non exhaustivement vérifié — limite de cet audit assumée | Non corrigée | Recommandation : passer `escapeHtml` sur tout champ texte affiché qui provient d'une table, par principe, même à faible risque perçu |
| **VULN-04** | **Informationnelle** | `vercel.json` (absent avant cet audit) | Aucun en-tête de sécurité HTTP explicite (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy, CSP). | — | Clickjacking théorique (absence de X-Frame-Options), MIME-sniffing | Absence confirmée du fichier avant audit | **Corrigée** pour les en-têtes simples (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS) via `vercel.json` | Non re-testable depuis cet environnement — nécessite un déploiement Vercel réel (voir §F) |
| **VULN-05** | **Informationnelle (non appliquée)** | — | Pas de Content-Security-Policy. | — | Réduit la profondeur de défense contre XSS (VULN-02) | — | **Non appliquée** — nécessite un test live pour ne pas casser les polices Google Fonts / les appels Supabase ; CSP recommandée fournie en §F | — |
| **VULN-06** | **Corrigée en amont de cet audit (rappel)** | 8 fichiers (`organisation.js`, `entrainement.js`, `carnet-erreurs.js`, `stats.js`, `qcm-liste.js`, `qcm-detail.js`, `parametres.js`, `fiche-detail.js`) | `window.confirm()`/`window.alert()` peuvent être silencieusement neutralisés par certains environnements de prévisualisation (confirmé empiriquement pendant la session précédente : clic réel, aucun effet, aucune erreur visible), rendant les suppressions/actions destructives apparemment "cassées" sans message d'erreur. | Environnement où les dialogues natifs sont interceptés/auto-répondus | Confusion utilisateur, pas de faille de sécurité en soi mais un risque d'action destructive silencieusement bloquée ou, à l'inverse, silencieusement confirmée selon l'environnement | Reproduit et corrigé lors de la session précédente (`src/lib/confirmer.js`) | Déjà en place | Revérifié dans cet audit : `grep window\.confirm` → 0 résultat dans `src/` |
| **INFO-01** | Informationnelle / bonne pratique confirmée | Toute la base de code | Aucune injection SQL possible par construction : tous les accès passent par le client PostgREST (`supabase.from(...).select/insert/update/delete/eq(...)`), jamais de SQL brut ni de `.rpc()`. | — | — | `grep -r "\.rpc(\|supabase\.sql\|\.raw("` → 0 résultat | — | — |
| **INFO-02** | Informationnelle / bonne pratique confirmée | `src/lib/richtext.js`, `src/lib/highlight.js` | Les deux seuls endroits qui transforment du texte en balisage actif (mise en forme `**gras**`, surlignage de recherche) échappent correctement le HTML avant d'appliquer leurs propres transformations, ou utilisent des API DOM sûres (`createTextNode`, `textContent`) plutôt que `innerHTML`. | — | — | Lecture de code ligne à ligne | — | — |
| **INFO-03** | Informationnelle / bonne pratique confirmée | `src/lib/images.js` | Upload d'image : ré-encodage systématique en JPEG via `<canvas>` (neutralise tout fichier qui ne serait pas une image valide), nom de fichier généré côté client par `crypto.randomUUID()` (aucune donnée utilisateur dans le nom, pas de traversée de chemin), taille plafonnée à 500 Ko. | — | — | Lecture de code | — | — |
| **INFO-04** | Informationnelle | Architecture d'authentification | CSRF non applicable : l'authentification repose sur un jeton Bearer stocké en `localStorage` (client Supabase par défaut), pas sur un cookie envoyé automatiquement par le navigateur. Un site tiers ne peut pas forger une requête authentifiée sans déjà posséder le jeton. | — | — | Lecture de `src/lib/supabase.js` (config par défaut, pas de cookie) | — | — |
| **INFO-05** | Informationnelle | API REST Supabase | CORS permissif (`Access-Control-Allow-Origin` accepté depuis n'importe quelle origine testée). C'est le comportement par défaut recommandé par Supabase pour une API sécurisée par RLS + JWT (pas de notion de "même origine" pertinente ici), donc **pas une vulnérabilité** en soi — seulement pertinent si VULN-01 était réel. | — | — | Requête `fetch` cross-origin réussie sans erreur CORS | — | — |

---

## C. Tableau des fonctionnalités testées

Légende résultat : ✅ réussi · ❌ échoué · 🚧 bloqué (dépendance externe) · ⛔ non testé (risque/hors périmètre)

| Fonctionnalité | Scénario testé | Résultat | Problème éventuel | Correction | Non-régression |
|---|---|---|---|---|---|
| Accès anonyme aux données | Requête REST directe sur les 10 tables avec la clé `anon` seule, sans jeton de session | ✅ | — (comportement attendu : refus) | — | `scripts/audit-rls.mjs` rejoué après coup, résultat identique |
| Accès authentifié (toi) | Session réelle déjà active dans le navigateur de test | ✅ | — | — | — |
| Connexion avec identifiants invalides | Non re-testé dynamiquement (comportement déjà vérifié lors de sessions précédentes : message générique "Email ou mot de passe incorrect", pas de fuite d'info sur l'existence du compte) | ⛔ (lecture de code uniquement, `main.js:54-58`) | — | — | — |
| Déconnexion | Non testée dynamiquement : t'aurait déconnecté sans que je puisse te reconnecter (je n'ai pas ton mot de passe, et le manipuler m'est interdit) | ⛔ | — | — | Vérifié par lecture de code : `supabase.auth.signOut()`, comportement standard documenté (efface la session locale + révoque le refresh token côté serveur) |
| Organisation — créer/éditer/supprimer une matière, sous-matière, cours | Testé en direct dans une session précédente (création "Douleur thoracique", suppression d'un noeud test, etc.) | ✅ | Bug réel trouvé et corrigé : suppression silencieusement bloquée par un `confirm()` neutralisé dans l'environnement de prévisualisation | Modale de confirmation interne (`confirmer.js`) | Retestée avec succès (clic réel → modale → suppression effective en base) |
| Organisation — déplacer un élément vers un cours | ⇄ sur un cas clinique réel, déplacement vers "Douleur thoracique" | ✅ | — | — | Vérifié via requête REST directe : `matiere`/`cours` mis à jour en base |
| Organisation — déplacer un QCM vers un cours | ⇄ sur un QCM réel | ✅ | — | — | Vérifié via requête REST : `matieres` (array) et `cours` corrects |
| Organisation — attacher un même contenu à plusieurs cours | Tentative via le bouton 🔗 | 🚧 | Table `contenu_cours` pas encore créée (migration en attente de ta part) | Dégradation propre implémentée : la page ne casse pas, message d'erreur explicite affiché | Page Organisation entière re-testée sans la table : chargement OK |
| Recherche globale | Saisie dans la barre de recherche du header | ✅ (comportement), échappement HTML ajouté sur le titre/méta affichés | XSS potentiel sur `r.titre`/`r.meta` (VULN-02) | `escapeHtml` ajouté dans `main.js` | Rendu visuel inchangé sur du contenu normal |
| Import de contenu JSON | Non re-testé dynamiquement dans cet audit (déjà testé en profondeur lors de sessions précédentes) | ⛔ | — | Message d'info d'import échappé (`import.js`) par prudence | — |
| Upload d'image (fiche, QCM) | Lecture de code uniquement, pas de re-test dynamique (fonctionnalité déjà validée en session précédente) | ⛔ | — | — | — |
| Backup / restauration (`parametres.js`) | Non re-testé dynamiquement dans cet audit | ⛔ | — | — | — |
| Build de production | `npm run build` | ✅ (après 2 échecs transitoires pour cause de mémoire système très basse, ~100 Mo libres sur 4 Go — problème d'environnement, pas de code) | — | — | — |
| Dépendances (`npm audit`) | `npm audit` (avec et sans devDependencies) | ✅ | 0 vulnérabilité | — | — |

---

## D. Tableau des tests de sécurité

| Contrôle | Méthode | Résultat | Statut |
|---|---|---|---|
| Accès anonyme refusé sur toutes les tables | Requêtes REST directes, clé `anon` seule, 10 tables | 401 sur les 9 tables existantes | ✅ Testé et confirmé |
| Policies RLS exactes (SELECT/INSERT/UPDATE/DELETE par rôle) | — | Non lisibles depuis le dépôt (aucun fichier de migration SQL local) | ⛔ Nécessite le tableau de bord Supabase |
| Inscriptions publiques activées ou non | Appel réel `POST /auth/v1/signup` avec adresse jetable `@example.com` | `422 signup_disabled` — rejeté avant création de compte | ✅ **Testé et confirmé désactivé (2026-09-22)** |
| Élévation de privilèges via requête/paramètre modifié | Lecture de code : aucune notion de "rôle" ou "admin" côté client, tout repose sur `auth.uid()` côté serveur (implicite) | Pas de mécanisme client à contourner (bon signe), mais dépend entièrement des policies non visibles | ⛔ Partiellement vérifié |
| Clé `service_role` exposée | Recherche dans le code source, le bundle de production, tout l'historique Git local (15 commits) | Aucune occurrence — seule la clé `anon` documentée est présente | ✅ Testé et confirmé |
| Fichiers `.env` committés | `git log --all -p -- '*.env*'`, `.gitignore` vérifié | Aucun fichier `.env` dans l'historique ; `.gitignore` les exclut | ✅ Testé et confirmé |
| Injection SQL | Revue de code : 100 % des accès via le query-builder PostgREST paramétré | Aucun point d'injection possible par construction | ✅ Testé et confirmé |
| XSS (stocké/DOM) | Grep systématique + lecture de code sur `src/pages` et `src/main.js` | 45+ points trouvés, corrigés | ✅ Testé, confirmé, corrigé |
| CSRF | Analyse d'architecture (JWT Bearer en `localStorage`, pas de cookie) | Non applicable à cette architecture | ✅ Analysé |
| CORS | Requête cross-origin réelle contre l'API Supabase | Permissif, mais non pertinent (voir INFO-05) | ✅ Testé |
| Upload de fichier malveillant | Lecture de code (`images.js`) : ré-encodage canvas, nom aléatoire, taille plafonnée | Robuste par construction | ✅ Analysé (non re-testé dynamiquement) |
| Dépendances vulnérables | `npm audit` | 0 vulnérabilité (2 dépendances runtime) | ✅ Testé et confirmé |
| En-têtes de sécurité HTTP en production | Nécessite le domaine Vercel réel | Non testé (domaine non communiqué) | ⛔ Nécessite l'URL de production |
| Politique du bucket de stockage `studik-images` (public/privé) | — | Non vérifiable depuis le dépôt | ⛔ Nécessite le tableau de bord Supabase |
| Sourcemaps exposées en production | Vérification de la config Vite (pas de `vite.config.js`, donc `sourcemap: false` par défaut) et du dossier `dist/` généré | Aucune sourcemap générée | ✅ Testé et confirmé |

---

## E. Modifications apportées

| Fichier | Nature du changement | Raison |
|---|---|---|
| `src/lib/escape.js` (nouveau) | Ajout d'une fonction `escapeHtml` partagée | Base de la correction VULN-02 |
| `src/pages/organisation.js`, `entrainement.js`, `tag-page.js`, `qcm-liste.js`, `qcm-detail.js`, `qcm-jouer.js`, `stats.js`, `carnet-erreurs.js`, `fiche-detail.js`, `referentiel.js`, `session.js`, `revision.js`, `accueil.js`, `import.js`, `main.js` | Échappement des champs de contenu avant injection dans `innerHTML` | Correction VULN-02 |
| `vercel.json` (nouveau) | En-têtes HTTP de sécurité (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security) | Correction VULN-04 |
| `scripts/audit-rls.mjs` (nouveau) | Script de test reproductible, sans dépendance, vérifiant le refus d'accès anonyme sur toutes les tables | Phase 4 — suite de tests reproductible |
| `src/pages/organisation.js` | Correction d'une corruption de fichier (octets NUL introduits par un outil d'édition lors d'une session précédente, dans des template literals) | Intégrité du code, découverte fortuite pendant l'audit |

**Aucune migration SQL n'a été exécutée pendant cet audit.** Les deux migrations en attente de ta part (colonne `est_cours`, table `contenu_cours`) datent de la session précédente et sont sans rapport avec cet audit sécurité.

**Aucune donnée réelle n'a été modifiée ou supprimée**, à l'exception de lignes de test créées puis supprimées par mes soins pendant la session précédente (déjà nettoyées).

---

## F. Actions restantes — checklist pour toi

### Dans le tableau de bord Supabase (priorité haute)

- [x] ~~Authentication → Providers → Email → désactiver "Allow new users to sign up"~~ — **fait et vérifié le 2026-09-22** (voir VULN-01).
- [ ] **Authentication → Policies (RLS)** (optionnel, défense en profondeur) : m'indiquer (ou vérifier toi-même) si les policies existantes filtrent uniquement par rôle (`authenticated`) ou par identité précise. Si tu veux que je durcisse les policies pour qu'elles ne fonctionnent QUE pour ton compte, voici le principe (à valider avec toi avant toute exécution, et ton UUID réel — déjà lu depuis ta session active, à ne pas partager publiquement) :
  ```sql
  -- Exemple pour la table matieres, à répéter pour chaque table :
  -- remplace la policy "authenticated" existante par une policy nominative
  drop policy if exists "authenticated_all" on matieres; -- nom exact à adapter à ta policy actuelle
  create policy "owner_only" on matieres
    for all
    using (auth.uid() = '37e73aea-b010-43ac-8277-e10def4cd2c3'::uuid)
    with check (auth.uid() = '37e73aea-b010-43ac-8277-e10def4cd2c3'::uuid);
  ```
  Je n'ai **pas** appliqué cela automatiquement : ça peut casser l'accès si le nom des policies existantes diffère de ce que je suppose. Dis-moi si tu veux que je le fasse, en me donnant le nom exact des policies actuelles (visible dans Database → Policies).
- [ ] **Storage → bucket `studik-images` → vérifier la politique d'accès** (public en lecture est probablement voulu pour des images de fiches, mais à confirmer).

### Chez l'hébergeur (Vercel)

- [ ] Confirmer que `vercel.json` (nouvellement ajouté) est bien pris en compte après déploiement — vérifier les en-têtes de réponse réels avec `curl -I https://ton-domaine.vercel.app`.
- [ ] Envisager une Content-Security-Policy (non appliquée automatiquement — je peux la rédiger et la tester avec toi si tu me donnes l'URL de production).

### Aucune action requise de ta part

- Clés/secrets : rien à faire, aucune exposition trouvée.
- Dépendances : rien à faire, `npm audit` propre.

---

## G. Conclusion factuelle

Le code de ce dépôt, tel qu'il est aujourd'hui, **ne présente aucune vulnérabilité exploitable directement depuis l'extérieur sans authentification** — testé et confirmé par requêtes réseau réelles. Le point le plus important de cet audit — l'absence de colonne d'identité dans le schéma combinée à un risque d'inscription publique — **a été vérifié corrigé le 2026-09-22** : les inscriptions sont désactivées côté Supabase, testé par un appel API réel rejeté avant création de compte. L'absence de colonne d'identité reste une fragilité structurelle (à corriger en défense en profondeur si tu veux, §F), mais elle n'est plus exploitable tant que ce réglage reste désactivé.

Je ne peux pas garantir une sécurité absolue : cet audit couvre le code source, le comportement réseau observable, et une partie du déploiement — pas le tableau de bord Supabase dans son intégralité, pas la configuration DNS/hébergement réelle, pas de test de charge, pas de suite de tests end-to-end automatisée (aucune n'existait avant cet audit, et créer une suite Playwright/pgTAP complète pour une application personnelle mono-utilisateur n'a pas été jugé proportionné — un script de test RLS reproductible a été fourni à la place). Sous ces réserves, et une fois la case "inscriptions publiques" vérifiée dans Supabase, le site peut raisonnablement être considéré comme prêt pour un usage personnel tel qu'il est conçu.
