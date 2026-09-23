# Studik — Contexte du projet

## Qu'est-ce que c'est

Studik est une plateforme personnelle de révision médicale (usage strictement solo, pas de produit multi-utilisateurs). Elle sert à Sullivan, étudiant en médecine (P2 puis années suivantes), pour :
- structurer et consulter des fiches de cours (référentiel)
- s'entraîner via des cas cliniques et des QCM
- suivre sa progression et revoir ses erreurs
- tenir une petite série de révision quotidienne (streak)

Le contenu (fiches, cas, QCM, matières) n'est **jamais saisi à la main dans l'interface**. Le workflow est : Sullivan donne un cours (PDF/photo/texte) à Claude en chat avec un prompt dédié (voir `src/data/prompts/`), Claude génère du JSON, Sullivan colle ce JSON dans la page `#import` du site. C'est un choix délibéré, pas un manque de fonctionnalité — ne pas proposer de formulaire de création de contenu dans l'UI sans qu'on en discute d'abord.

## Stack technique

- **Vite** (vanilla JS, pas de framework front — pas de React/Vue). Chaque "page" est une fonction JS qui génère du HTML en template literal et l'injecte via `innerHTML`.
- **Supabase** : authentification (email + mot de passe, compte unique, pas d'inscription publique) + base de données Postgres + Row Level Security.
- **jsPDF** pour l'export PDF.
- Déployé sur **Vercel**, dépôt GitHub `ssully971/Studik` (public — seul le code y est, aucune donnée personnelle : les clés Supabase committées sont la clé publique anon, protégée par RLS, pas un secret).
- Routing : hash-based maison dans `src/main.js` (`#nomdelapage` ou `#nomdelapage/id`), pas de librairie de routing.

## Structure des fichiers

```
src/
  main.js              — shell (navbar, menu, recherche globale, raccourcis clavier), routeur par hash
  lib/                 — toute la logique d'accès aux données (un fichier par domaine)
  pages/               — une fonction render*(container, ...params) par page
  styles/main.css      — feuille de style unique, pas de CSS modules
  data/anecdotes.json  — 365 anecdotes médicales pour l'accueil
  data/prompts/*.md    — prompts prêts à copier pour générer du contenu (fiches, cas, QCM, matières)
```

## Identité visuelle (à respecter, ne pas réinventer)

- Fond noir OLED (`#000000`), surfaces `#0D0D0D`/`#141414`, texte `#EDEAE2`
- Trois couleurs de type, utilisées comme code couleur constant partout (onglet coloré sur les listes, bordure de fiche) : clinique = vert `#4EA189`, mécanisme = ocre `#C39A5C`, structure = bleu `#6C8FC2`
- Typo : **Lora** (titres, classe `.voice`), **IBM Plex Sans** (texte courant), **IBM Plex Mono** (labels techniques, ids, sélecteurs)
- Composants réutilisés partout : `.fiche-row` (liste avec onglet coloré), `.settings-card` (carte avec bordure), `.btn` / `.btn.primary`, `.periode-select` (petit select stylé), `.modal-overlay`/`.modal-panel` (popup de détail)

## Modèle de données (Supabase, RLS activée partout, un seul utilisateur)

Trois "types" génériques transversaux à tout le contenu : `clinique` / `mecanisme` / `structure`.

- **matieres** : `id, nom, type, couleur, ordre_affichage, annee, semestre, archive` — l'année/le semestre vivent ICI, pas sur les fiches.
- **fiches** : `id, matiere, type, titre, synonymes, contenu_structure (jsonb), tags, pre_requis, consequences, pathologies_associees, statut (brouillon/valide/a_revoir/archive), notes_perso, source_cours, date_creation, date_maj, date_derniere_revision, dernier_resultat (bien/pas_bien)`. `contenu_structure` change de forme selon `type` (description/contexte_recherche pour clinique, étapes/facteurs/conséquences pour mécanisme, localisation/rapports/fonction pour structure). Le texte de `contenu_structure` supporte une mise en forme légère : `**gras**`, `==surligné==`, `!!important!!` (voir `src/lib/richtext.js`).
- **cas_cliniques** : `id, type, matiere, niveau (1-3), fiches_liees, enonce (jsonb: situation+elements), question, reponse_attendue (jsonb, forme différente par type), statut, date_creation`.
- **tentatives** (essais de cas cliniques) : `id, cas_id, reussi, reponse_donnee, a_revoir, date_tentative`.
- **qcm** : `id, titre, matieres (array, un QCM peut couvrir plusieurs matières), questions (jsonb: [{enonce, items:[{texte,correct,explication}], explication}]), duree_minutes, fiches_liees, statut, date_creation`.
- **qcm_tentatives** : `id, qcm_id, mode (entrainement/concours), score, score_max, reponses (jsonb), duree_utilisee_secondes, a_revoir, date_tentative`. Barème identique à Outremed : 1 pt si 0 erreur sur la question, 0,5 pt si 1 erreur, 0 pt si 2+ erreurs (voir `scoreQuestion`/`scoreQcm`/`questionsRateesDeLaTentative`, fonctions pures dans `lib/scoring.js`, ré-exportées par `lib/qcm.js` pour ne pas casser les imports existants). Comportements actuels non modifiés mais notables : `scoreQuestion([], ...)` renvoie 1 (aucun item = aucune erreur possible) ; `scoreQuestion(items, undefined)` lève une exception (pas de garde).
- **captures** : `id, texte, traitee, date_creation` — notes rapides à trier plus tard.
- **checkins** : `jour` (date, clé primaire) — un check-in manuel par jour pour le streak (volontaire, pas automatique).
- **tags_reference** : `nom` (clé primaire) — liste de tags fermée que Sullivan gère lui-même, affichée sur la page Prompts pour copier dans ses prompts d'import.

Chaque nouvelle table doit recevoir un `grant select, insert, update, delete on public.<table> to authenticated;` explicite en plus de la policy RLS — Supabase ne l'accorde plus automatiquement depuis mai 2026, l'oublier cause un "permission denied" silencieux.

## Décisions de conception à connaître avant de proposer des changements

- **Suppression réelle, pas de soft-delete**, compensée par un export/import JSON complet dans Paramètres (backup manuel). Ne pas ajouter de `deleted_at` sans en discuter.
- **Pas de répétition espacée (SRS)** ni de graphe de connaissances façon Obsidian — explicitement écartés à plusieurs reprises, à garder pour la toute fin si jamais.
- Le statut `a_revoir` (fiches, tentatives, qcm_tentatives) alimente les pages Révision / Carnet d'erreurs. Une tentative de cas/QCM ratée passe automatiquement `a_revoir = true` à l'enregistrement.
- Les liens entre fiches (`pre_requis`/`consequences`) et vers des fiches (`fiches_liees` sur cas/QCM) sortent **toujours vides** des prompts d'import — Sullivan les ajoute lui-même ensuite via l'interface (recherche live sur la page détail d'une fiche).
- Sur `#fiche/:id`, layout en 2 colonnes sur desktop (≥860px) avec une sidebar à onglets (Liens/Notes perso/Gestion), empilé en une colonne sur mobile.
- Les 3 gabarits de correction pour l'entraînement (clinique: signes/pathologies, mécanisme: evenements/consequences, structure: elements/identification) sont définis dans `GABARITS` en haut de `entrainement.js` et repris dans `carnet-erreurs.js`.

## Pièges déjà rencontrés (à ne pas refaire)

- **Ne jamais mettre `style="grid-template-columns: 4px 1fr auto;"` en inline sur `.fiche-row`** — c'est déjà la valeur par défaut de la classe, et un style inline bloque la règle mobile qui doit la faire passer en 2 colonnes sous 720px. Ce bug est apparu 4 fois dans des fichiers différents.
- Dans `main.js`, `currentUserId` doit être initialisé à `undefined`, jamais à `null` — sinon le premier appel de `handleUser(null)` (utilisateur déconnecté) est confondu avec "aucun changement" et l'écran de connexion ne s'affiche jamais (écran noir).
- Avant de remplacer un fichier entier, vérifier qu'on a bien la version réelle et complète (idéalement en lisant le fichier depuis le disque plutôt que de reconstruire de mémoire) — plusieurs régressions ont eu lieu en redonnant un fichier "complet" qui ne l'était pas.
- Les grilles CSS ont besoin de `min-width: 0` sur leurs enfants dès qu'elles contiennent des champs/texte qui pourraient forcer un débordement (rencontré sur la grille d'édition des matières et sur `.fiche-layout`).
- **Ne jamais faire `container.addEventListener(...)` ou `document.addEventListener(...)` à l'intérieur d'une fonction `render*()` de page** sans y réfléchir : `container` (souvent `#content`) et `document` sont persistants sur toute la session, alors que `render*()` est rappelée à chaque navigation vers cette page — l'écouteur s'accumule à chaque visite au lieu d'être remplacé. Rencontré dans `session.js`, `fiche-detail.js` (×2), `accueil.js` et `tag-filter.js` (composant partagé par 5 pages). Corrections possibles : (a) attacher l'écouteur à un élément recréé à chaque rendu (ex. le `.wrap` de la page) quand la portée du clic peut se limiter à cet élément, ou (b) si l'écouteur doit rester sur `document` (fermer un menu au clic n'importe où sur la page), dédoublonner en gardant la référence de la fonction et en faisant `removeEventListener` avant de la reposer (voir `tag-filter.js`).

## Tests

- `npm test` (vitest, mode `run`) — pour l'instant uniquement des fonctions pures, pas de jsdom/DOM : `lib/scoring.js`, `lib/escape.js`, `lib/richtext.js`, `lib/import-schemas.js`.
- Échappement HTML : une seule source, `src/lib/escape.js` (`escapeHtml`, échappe `& < > " '`). Ne pas recréer de copie locale — `main.js`, `import.js` et `richtext.js` en avaient chacun une auparavant, désormais tous importent depuis `lib/escape.js`.

## Validation à l'import (`#import`)

- `src/lib/import-schemas.js` (zod) valide la forme de chaque élément collé dans `#import`, après les contrôles existants (id présent, doublons, résolution des ids déjà en base) et avant tout effet de bord (création de tags/matières/sous-matières/cours, insertion) — tout-ou-rien : une seule erreur bloque tout le lot, rien n'est inséré. `zod` est en dépendance de prod mais chargé par `await import(...)` seulement au clic sur "Importer", pour ne pas alourdir le bundle principal (vérifié : chunk séparé `import-schemas-*.js` au build).
- Un id déjà existant = mise à jour partielle (`upsertPartiel`, non modifié, toujours séquentiel et non atomique) : tous les champs deviennent optionnels mais restent validés s'ils sont présents (`ficheSchema(false)`/`casSchema(false)`/`qcmSchema(false)` vs `(true)` pour un nouvel élément).
- `contenu_structure` (fiches) et `reponse_attendue` (cas) sont validés selon le type/gabarit — `reponse_attendue` partage sa définition de gabarit (`GABARITS_CAS`) avec `lib/cas.js`, donc jamais de divergence possible avec l'affichage.
- Écarts trouvés entre les prompts (`src/data/prompts/*.md`) et le code, non tranchés, à trancher par Sullivan :
  - `prompt-matieres.md` existe mais `#import` n'a **aucune cible "matières"** (seulement fiches/cas/qcm) — ce prompt n'est donc branché sur aucun chemin d'import direct.
  - `pathologies_associees` n'apparaît que dans `prompt-fiche-clinique.md`, mais `fiche-detail.js` l'affiche pour les 3 types sans distinction — le schéma l'accepte en optionnel pour les 3 types plutôt que de le refuser pour mécanisme/structure.
  - `q.image` (image d'une question QCM, ajoutée après coup via l'upload dans `#qcm/:id`) n'apparaît dans aucun prompt — accepté en optionnel par le schéma.

## Build & déploiement

- `npm run dev` en local, `npm test` puis `npm run build` pour vérifier avant de pousser.
- Le repo GitHub public est relié à Vercel : chaque push sur `main` redéploie automatiquement.
- Pas de variables d'environnement utilisées (les clés Supabase sont en dur dans `src/lib/supabase.js`), c'est un choix assumé pour ce projet, pas un oubli.
