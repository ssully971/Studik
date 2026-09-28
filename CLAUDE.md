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
  pages/externat/      — pages du mode Externat (préfixe #edn-.../#ecos-..., voir plus bas)
  styles/main.css      — feuille de style unique, pas de CSS modules
  data/anecdotes.json  — 365 anecdotes médicales pour l'accueil
  data/prompts/*.md    — prompts prêts à copier pour générer du contenu (fiches, cas, QCM, matières)
  data/prompts/externat/*.md — idem, banque de prompts du mode Externat
supabase/migrations/*.sql — 001 = schéma des tables Externat, 002 = ajout ponctuel côté P2
                     (sous_matiere sur cas_cliniques/qcm) ; à appliquer manuellement, non automatique
docs/externat/         — spec, journal de décisions et liste de tâches manuelles du mode Externat
```

## Identité visuelle (à respecter, ne pas réinventer)

- Fond noir OLED (`#000000`), surfaces `#0D0D0D`/`#141414`, texte `#EDEAE2`
- Trois couleurs de type, utilisées comme code couleur constant partout (onglet coloré sur les listes, bordure de fiche) : clinique = vert `#4EA189`, mécanisme = ocre `#C39A5C`, structure = bleu `#6C8FC2`
- Typo : **Lora** (titres, classe `.voice`), **IBM Plex Sans** (texte courant), **IBM Plex Mono** (labels techniques, ids, sélecteurs)
- Composants réutilisés partout : `.fiche-row` (liste avec onglet coloré), `.settings-card` (carte avec bordure), `.btn` / `.btn.primary`, `.periode-select` (petit select stylé), `.modal-overlay`/`.modal-panel` (popup de détail)
- `@media print` (fin de `main.css`) : pensé pour `#fiche/:id` (impression navigateur, Ctrl+P — indépendant de l'export PDF dédié `lib/pdf.js`, non touché). Redéfinit `--ink`/`--surface`/`--surface-2`/`--hairline`/`--text*` en blanc/noir (mais pas `--clinique`/`--mecanisme`/`--structure`, pour garder la bordure de couleur du type sur `.detail-header`), masque topbar/tabbar mobile/sidebar/boutons/signalement, retire le fond d'écran et les effets verre dépoli, `break-inside: avoid` sur `.detail-header`/`.detail-section`.

## Modèle de données (Supabase, RLS activée partout, un seul utilisateur)

Trois "types" génériques transversaux à tout le contenu : `clinique` / `mecanisme` / `structure`.

- **matieres** : `id, nom, type, couleur, ordre_affichage, annee, semestre, archive` — l'année/le semestre vivent ICI, pas sur les fiches.
- **fiches** : `id, matiere, type, titre, synonymes, contenu_structure (jsonb), tags, pre_requis, consequences, pathologies_associees, statut (brouillon/valide/a_revoir/archive), notes_perso, source_cours, date_creation, date_maj, date_derniere_revision, dernier_resultat (bien/pas_bien), a_corriger (boolean, défaut false), note_correction (text, nullable)`. `contenu_structure` change de forme selon `type` (description/contexte_recherche pour clinique, étapes/facteurs/conséquences pour mécanisme, localisation/rapports/fonction pour structure). Le texte de `contenu_structure` supporte une mise en forme légère : `**gras**`, `==surligné==`, `!!important!!` (voir `src/lib/richtext.js`). `a_corriger` est indépendant de `statut` : une fiche peut être `a_revoir` ET `a_corriger` en même temps (voir "Signaler une erreur" sur `#fiche/:id`, et le filtre "À corriger" du Référentiel).
- **cas_cliniques** : `id, type, matiere, sous_matiere, cours, niveau (1-3), fiches_liees, enonce (jsonb: situation+elements), question, reponse_attendue (jsonb, forme différente par type), statut, date_creation`. `sous_matiere` (migration 002) permet de rattacher un cas directement à une sous-matière sans cours (ex. un sujet d'annale qui concerne toute la sous-matière) — même sémantique que `fiches.sous_matiere`.
- **tentatives** (essais de cas cliniques) : `id, cas_id, reussi, reponse_donnee, a_revoir, date_tentative`.
- **qcm** : `id, titre, matieres (array, un QCM peut couvrir plusieurs matières), sous_matiere, cours, questions (jsonb: [{enonce, items:[{texte,correct,explication}], explication}]), duree_minutes, fiches_liees, statut, date_creation`. `sous_matiere`/`cours` sont des champs uniques (pas des tableaux) même si `matieres` en est un — un QCM n'a qu'un seul emplacement précis dans la hiérarchie, quelles que soient les matières qu'il couvre.
- **qcm_tentatives** : `id, qcm_id, mode (entrainement/concours), score, score_max, reponses (jsonb), duree_utilisee_secondes, a_revoir, date_tentative`. Barème identique à Outremed : 1 pt si 0 erreur sur la question, 0,5 pt si 1 erreur, 0 pt si 2+ erreurs (voir `scoreQuestion`/`scoreQcm`/`questionsRateesDeLaTentative`, fonctions pures dans `lib/scoring.js`, ré-exportées par `lib/qcm.js` pour ne pas casser les imports existants). Comportements actuels non modifiés mais notables : `scoreQuestion([], ...)` renvoie 1 (aucun item = aucune erreur possible) ; `scoreQuestion(items, undefined)` lève une exception (pas de garde).
- **captures** : `id, texte, traitee, date_creation` — notes rapides à trier plus tard.
- **checkins** : `jour` (date, clé primaire) — un check-in manuel par jour pour le streak (volontaire, pas automatique).
- **tags_reference** : `nom` (clé primaire) — liste de tags fermée que Sullivan gère lui-même, affichée sur la page Prompts pour copier dans ses prompts d'import.

Chaque nouvelle table doit recevoir un `grant select, insert, update, delete on public.<table> to authenticated;` explicite en plus de la policy RLS — Supabase ne l'accorde plus automatiquement depuis mai 2026, l'oublier cause un "permission denied" silencieux.

## Lectures Supabase et pagination

PostgREST (donc Supabase) plafonne **toute** lecture à 1000 lignes par défaut, sans erreur — au-delà, `data` fait simplement 1000 lignes, tronqué en silence. `src/lib/supabase-paginate.js` fournit les deux mécanismes génériques pour ne jamais dépendre de ce plafond ; aucune logique de pagination ne doit être recopiée dans un fichier appelant.

- **`paginerTout(fabriqueRequete)`** : lit une table/requête entière page par page (`.range()`), s'arrête dès qu'une page contient moins de 1000 lignes. `fabriqueRequete` doit être rappelable (reconstruit toute la requête à chaque page — un query builder Supabase ne se réutilise pas après un premier `await`) et **doit trier sur une colonne (ou un couple de colonnes) qui garantit un ordre total**, sinon une même ligne peut apparaître deux fois ou en sauter une entre deux pages. Aucune des colonnes de tri déjà en place dans le projet n'est une clé unique à elle seule (`titre`, `ordre_affichage`, `date_creation`, `date_tentative`...) : toutes ont reçu `id` (ou la vraie clé primaire quand ce n'est pas `id` — ex. `cible` sur `edn_srs`, `jour` sur `checkins`, déjà uniques à elles seules donc sans second critère à ajouter) en second critère de tri quand nécessaire. Piège notable : `matieres.ordre_affichage` vaut `0` par défaut pour beaucoup de lignes (voir `lib/sync.js`) — sans `id` en second critère, ça aurait cassé silencieusement.
- **`requeteParLots(ids, fabriqueRequete)`** : découpe un `.in(colonne, ids)` en lots de 200 (au-delà, l'URL de la requête peut devenir trop longue pour PostgREST/le proxy), lots indépendants lancés en parallèle, fusionnés sans perte. Ne garantit pas que l'ordre du résultat suive l'ordre de `ids` (`.in()` ne l'a jamais garanti, même sans découpage).

**Avant d'ajouter une nouvelle lecture qui rapatrie "tout" d'une table**, classe-la : **A** (peut réalistement dépasser 1000 lignes un jour — contenu qui grossit sans limite : fiches, cas, QCM, tentatives, matières/cours, captures, checkins, contenu Externat...) → `paginerTout`/`requeteParLots` ; **B** (bornée par construction — une seule entité par id, un référentiel externe fixe comme `r2c_items`/`r2c_sdd`/`constantes_bio`, une liste fermée gérée à la main comme `tags_reference`, un état "actif" par nature petit comme les QCM en cours (`qcm_progression`, une ligne par QCM tant qu'il n'est pas fini/abandonné) ou une lecture bornée par un parent (les tentatives d'UN cas/QCM/station, les questions d'UN dossier, les sous-matières d'UNE matière — le nombre d'enfants d'une seule entité ne dépasse jamais 1000 en pratique)) → laisser tel quel, ne pas paginer mécaniquement partout ; **C** (agrégat/statistique calculé côté client à partir de tout l'historique) → même helper que A plutôt qu'une fonction Postgres dédiée (aucune fonction SQL n'existe ailleurs dans ce projet, un seul mécanisme à maintenir plutôt que deux).
- **Piège rencontré lors de l'audit final** : deux fonctions sœurs dans le même fichier, sur le même filtre, avec le MÊME risque de dépassement — l'une migrée, l'autre oubliée, sans qu'aucun test ni aucune erreur ne le signale (silencieux comme le piège `idsQuestions`/`idsDossiers` déjà documenté). Rencontré sur `renommerMatiereQcm` (`lib/qcm.js`, lecture non paginée de tout `qcm` filtré par `.contains('matieres', [ancienNom])`) alors que `deleteTentativesQcmByMatiere`, juste en dessous, applique bien `paginerTout` au même filtre ; et sur `getCapturesNonTraitees` (`lib/captures.js`) alors que `getAllCaptures`, dans le même fichier, est bien paginée. Les deux corrigées. Un audit qui vérifie fichier par fichier plutôt que fonction par fonction peut laisser passer ce genre d'écart entre deux fonctions voisines qui semblent couvertes par "le fichier a déjà été traité". `getActiviteParJour` (`lib/activite.js`, agrégat pour la heatmap, catégorie C) avait le même défaut sur ses 3 sous-lectures (fenêtre de 140 jours — pas un plafond de lignes, un usage intensif peut quand même dépasser 1000 tentatives sur la fenêtre) : corrigé pareil.

## Sauvegarde et restauration (`src/lib/backup.js`)

Orchestre l'export/restauration de Paramètres pour P2 ET Externat, sans dupliquer les fonctions `insertX`/`restaurerX` déjà utilisées ailleurs (import, Banque...) — `parametres.js` ne fait qu'appeler ce module et gérer le fichier/le DOM.

- **Champ `version`** dans le fichier exporté (actuellement `2`). Un fichier **sans** `version` (toute sauvegarde faite avant l'ajout de l'Externat) déclenche `restaurerLegacy`, une copie figée du comportement P2 d'origine, à la ligne près — ne JAMAIS la faire évoluer, une évolution du format se fait uniquement dans le chemin versionné et incrémente `VERSION_SAUVEGARDE`.
- **Ordre de restauration déduit des vraies contraintes de clé étrangère** des migrations (`supabase/migrations/001_externat_fondations.sql` pour l'Externat) : matières (parents avant enfants, `parent_id` auto-référencé) → fiches/cas/QCM → leurs tentatives → captures/checkins/tags → r2c_items/r2c_sdd/constantes_bio → dossiers EDN → questions EDN (`dossier_id` référence un dossier) → tentatives EDN → état SRS → stations ECOS → tentatives ECOS (`station_id` référence une station) → préférences Externat.
- **Pas de transaction atomique** (aucune fonction Postgres dédiée, upsert partiel séquentiel comme le reste du projet) : `preparerRestauration(data)` fait donc un préflight complet AVANT toute écriture — structure (chaque section attendue doit être un tableau) puis résolvabilité des références (`dossier_id`/`station_id`/`parent_id` doivent exister dans le fichier OU déjà en base) — et renvoie `{ok:false, erreurs}` sans rien écrire si un problème est détecté. Si malgré tout une étape échoue à l'écriture, `restaurerSauvegarde` relance une erreur qui nomme la table en cause ; relancer la restauration entière depuis le même fichier ne duplique rien (upsert par id).
- **Préférences Externat restaurées uniquement si elles ont une vraie valeur sauvegardée** (`preferences.cycle`/`plafond_revisions`/`tags_erreur` non `null`) — jamais le défaut applicatif que renvoient `getPlafondRevisions()`/`getTagsErreur()` quand la préférence n'a jamais été écrite, qui écraserait sinon une préférence existante sur la base cible.
- **Dégradation propre à l'export** : si la migration 001 n'est pas appliquée, `exporterSauvegarde()` omet simplement la clé `externat` (détecté via `estTableAbsente`, voir `lib/externat-schema.js`) plutôt que de faire échouer tout l'export P2.
- **Ne sauvegarde pas les fichiers du Storage** (images), seulement les chemins qui y pointent (`edn_questions.image`, zones ZAP dans `contenu`, `article_url`...) — comme pour le P2, texte visible sur la carte Sauvegarde, pas une évolution prévue par ce mécanisme.
- **Avertissement si la file hors-ligne (IndexedDB, §8 lot 8) contient encore des tentatives non envoyées** au moment de l'export : elles ne sont pas encore en base, donc absentes du fichier — `exporterSauvegarde()` renvoie `nombreTentativesEnAttente`, affiché par `parametres.js`.
- **Bug corrigé au passage (préexistant, indépendant de l'Externat)** : l'export "tentatives" (cas cliniques) utilisait `getStatsTentatives()` (`lib/cas.js`), qui ne sélectionne que ce qu'affiche la page Stats (`id, reussi, date_tentative, cas_cliniques(matiere, type, question)`) — ni `cas_id`, ni `reponse_donnee`, ni `a_revoir`, ni même l'`id` du cas joint. Une restauration produisait donc des tentatives avec `cas_id: undefined`. Corrigé par une fonction dédiée, `getAllTentativesRaw()` (`select('*')`), utilisée uniquement par la sauvegarde.

## Décisions de conception à connaître avant de proposer des changements

- **Suppression réelle, pas de soft-delete**, compensée par un export/import JSON complet dans Paramètres (backup manuel, `lib/backup.js` — couvre P2 ET Externat depuis la branche `reliability-and-ui-fixes`, voir plus bas). Ne pas ajouter de `deleted_at` sans en discuter.
- **Pas de répétition espacée (SRS) en mode P2.** Décision inversée pour le mode Externat (EDN/ECOS) uniquement, ajouté en phase Externat V2 (voir `docs/externat/SPEC-EXTERNAT-V2.md` §0.3 et la section dédiée plus bas) : le SRS y est désormais volontaire. Le mode P2 garde exactement son fonctionnement d'avant, sans SRS ni graphe de connaissances façon Obsidian.
- Le statut `a_revoir` (fiches, tentatives, qcm_tentatives) alimente les pages Révision / Carnet d'erreurs. Une tentative de cas/QCM ratée passe automatiquement `a_revoir = true` à l'enregistrement.
- Les liens entre fiches (`pre_requis`/`consequences`) et vers des fiches (`fiches_liees` sur cas/QCM) sortent **toujours vides** des prompts d'import — Sullivan les ajoute lui-même ensuite via l'interface (recherche live sur la page détail d'une fiche).
- Sur `#fiche/:id`, layout en 2 colonnes sur desktop (≥860px) avec une sidebar à onglets (Liens/Notes perso/Gestion), empilé en une colonne sur mobile.
- Les 3 gabarits de correction pour l'entraînement (clinique: signes/pathologies, mécanisme: evenements/consequences, structure: elements/identification) sont définis dans `GABARITS` en haut de `entrainement.js` et repris dans `carnet-erreurs.js`.
- Propositions de QCM (`qcm-jouer.js`, `qcm-retry-session.js`, `pages/externat/question-engine.js`) : classe `qcm-proposition` en PLUS de `.checkbox-label` (jamais à la place) — texte/case plus grands, zone tactile ≥44px. `.checkbox-label` seule reste inchangée partout ailleurs (Paramètres, Organisation, ECOS, `entrainement.js` — volontairement pas cette dernière malgré la structure de checkboxes identique, hors périmètre demandé). Orthogonale au code couleur (`ok`/`missed`/`wrong` sur `qcm-jouer`/`qcm-retry-session`, `edn-prop-ok`/`edn-prop-wrong` en liste de correction séparée sur le moteur Externat) : deux classes coexistent sur le même label sans conflit de spécificité (l'une change taille/padding, l'autre couleur/bordure).
- Le résumé de fin de QCM (`terminerQcm` dans `qcm-jouer.js`) propose "Refaire mes erreurs" (visible seulement si au moins une question a un score < 1 ET que l'enregistrement de la tentative a réussi) via `definirScopeRetry({criteres:{qcmId}}, ...)` + `#qcm-retry-session` — même mécanisme que les boutons de retry de `carnet-erreurs.js`, à garder cohérent si l'un des deux change. Il affiche aussi les fiches liées (`qcm.fiches_liees`) si non vide, via `getFichesByIds` (lib/fiches.js, résout un tableau d'ids en `{id, titre}` en un seul aller-retour, ids introuvables silencieusement absents).
- Bloc "Reprendre" sur l'accueil P2 (`accueil.js`) : liste les QCM en cours (`getProgressions()`, `lib/qcm-progression.js`, déjà trié par `date_derniere_activite desc`), titre + `Question ${index_courant + 1} / ${questions.length}` + lien direct `#qcm-jouer/:id` (qui détecte lui-même la progression existante et reprend, sans code dédié). Réutilise `.fiche-row`/`.fiche-actions` (3e colonne de la grille) tel quel. Bloc entièrement absent du DOM (pas juste cosmétiquement masqué) si aucun QCM en cours ; lignes dont le QCM a été supprimé depuis (`p.qcm` absent de l'embed) ignorées plutôt que de planter.
- `#fiche/:id` a un bouton discret "Signaler une erreur" en bas de page (indépendant du statut, voir `a_corriger`/`note_correction` dans le modèle de données) : ouvre une note optionnelle, enregistre via `updateFiche`, puis révèle "Copier pour Claude" (`navigator.clipboard`, repli par sélection du texte dans un `<textarea>` hors-écran si l'API échoue/est refusée — pas de `document.execCommand`). Format copié : `[Studik] fiche <id> — <titre> — <note>` (le tiret + note est omis si la note est vide). Le Référentiel a un filtre "À corriger" (`.filter-btn` non exclusif, à côté des filtres de type) qui filtre sur `f.a_corriger`.

## Raccourcis clavier

- Un seul listener réel (`setupRaccourcisClavier` dans `main.js`), qui calcule le contexte courant (route = premier segment du hash, éléments DOM présents/activables, garde de saisie) et délègue la décision à `resoudreRaccourci` (`src/lib/raccourcis.js`, fonction pure et testée, aucun accès DOM). L'action retournée agit ensuite par `.click()` sur un id stable ou par navigation de hash — jamais en dupliquant la logique interne d'une page. L'aide (`?`) est générée depuis `tableAide()`, dérivée des mêmes constantes que le résolveur (`SEQUENCE_G`, `ROUTES_SANS_N_R`), donc ne peut pas diverger silencieusement.
- Global : `/` et `Ctrl/Cmd+K` (recherche), `?` (aide), `c` (#capture), `g` puis une lettre dans la seconde qui suit (h/f/q/e/s/t/i/r — `r` cible `#accueil`, où vit le bloc "Reprendre" des QCM en cours ; comme `t` déjà réutilisé pour un sens différent hors séquence sur `#import`, `r` seul reste `#revision`, sans conflit puisque la séquence `g` a priorité tant qu'elle est active), `Échap` (ferme une modale `.modal-overlay:not(.hidden)` en priorité, sinon le menu/la recherche, puis **retour arrière** si la route est `fiche` et qu'aucune modale n'était ouverte), `n`/`r` (Entraînement/Révision) **désactivés sur `qcm-jouer`, `qcm-retry-session` et `session`** (risque de quitter une question en cours par accident).
- QCM en cours (`qcm-jouer`, `qcm-retry-session`) : `1`–`5` cochent/décochent un item (sauf disabled après correction), `Entrée` = premier bouton présent parmi `#valider-btn`/`#suivant-btn`/`#finir-btn`, `←`/`→` = `#precedent-btn`/`#suivant-btn`, `e` = `#refaire-erreurs-btn` (résultat, voir chantier boucle d'erreurs). `Espace` reste réservé à `#valider-btn` (comportement historique, inchangé) et reste **natif** sur une checkbox focalisée (ne déclenche pas `#valider-btn`).
- Entraînement / Session / Fiche détail : `Espace`/`Entrée` = `#valider-btn` seul (pas de chaîne suivant/finir ici), `b`/`p` = `#revu-bien-btn`/`#revu-pas-bien-btn`, `←`/`→` = `#precedent-btn`/`#suivant-btn` si présents.
- Listes (Référentiel, Révision, Erreurs, Tag) : `j`/`k` déplacent `.kbd-focus` sur les `.fiche-row` de `#content` (toujours actif s'il y a des lignes) ; `↓`/`↑` pareil mais seulement si une ligne est déjà focalisée (sinon scroll natif, pas de `preventDefault`) ; `Entrée` ouvre la ligne focalisée sur Référentiel/Révision/Tag seulement — **pas sur Erreurs** (les lignes du carnet d'erreurs n'ont pas de `data-id`/action d'ouverture unique et fiable, plusieurs boutons distincts par ligne, `j`/`k` y fonctionnent quand même).
- Asymétries volontaires, signalées mais non tranchées : `entrainement.js` (mode "S'entraîner") a la même structure de checkboxes que les écrans QCM mais **1-5 n'y sont pas mappés** (hors du périmètre demandé) ; `n`/`r` ne sont désactivés que sur les 3 routes listées ci-dessus, pas sur `entrainement` lui-même, alors qu'il perd aussi une réponse en cours.
- `Ctrl/Cmd+Entrée` résout comme `Entrée` (même chaîne contextuelle) mais fonctionne même en train de taper — interprétation par défaut, pas explicitement spécifiée.
- `<kbd class="kbd-hint">` (IBM Plex Mono, masqué par `@media (hover: none)`) ajouté sur les boutons principaux des écrans QCM et Entraînement uniquement (`#valider-btn`, `#suivant-btn`, `#precedent-btn`, `#finir-btn`, `#refaire-erreurs-btn`), pas sur fiche-détail/session.

## Pièges déjà rencontrés (à ne pas refaire)

- **Ne jamais mettre `style="grid-template-columns: 4px 1fr auto;"` en inline sur `.fiche-row`** — c'est déjà la valeur par défaut de la classe, et un style inline bloque la règle mobile qui doit la faire passer en 2 colonnes sous 720px. Ce bug est apparu 4 fois dans des fichiers différents.
- Dans `main.js`, `currentUserId` doit être initialisé à `undefined`, jamais à `null` — sinon le premier appel de `handleUser(null)` (utilisateur déconnecté) est confondu avec "aucun changement" et l'écran de connexion ne s'affiche jamais (écran noir).
- Avant de remplacer un fichier entier, vérifier qu'on a bien la version réelle et complète (idéalement en lisant le fichier depuis le disque plutôt que de reconstruire de mémoire) — plusieurs régressions ont eu lieu en redonnant un fichier "complet" qui ne l'était pas.
- Les grilles CSS ont besoin de `min-width: 0` sur leurs enfants dès qu'elles contiennent des champs/texte qui pourraient forcer un débordement (rencontré sur la grille d'édition des matières et sur `.fiche-layout`).
- **Ne jamais faire `container.addEventListener(...)` ou `document.addEventListener(...)` à l'intérieur d'une fonction `render*()` de page** sans y réfléchir : `container` (souvent `#content`) et `document` sont persistants sur toute la session, alors que `render*()` est rappelée à chaque navigation vers cette page — l'écouteur s'accumule à chaque visite au lieu d'être remplacé. Rencontré dans `session.js`, `fiche-detail.js` (×2), `accueil.js` et `tag-filter.js` (composant partagé par 5 pages). Corrections possibles : (a) attacher l'écouteur à un élément recréé à chaque rendu (ex. le `.wrap` de la page) quand la portée du clic peut se limiter à cet élément, ou (b) si l'écouteur doit rester sur `document` (fermer un menu au clic n'importe où sur la page), dédoublonner en gardant la référence de la fonction et en faisant `removeEventListener` avant de la reposer (voir `tag-filter.js`).
- **`class="hidden"` ne masque RIEN par défaut dans ce projet** — il n'existe aucune règle générique `.hidden { display: none }` dans `main.css`. Chaque composant qui l'utilise a sa propre règle combinée (`.correction.hidden`, `.modal-overlay.hidden`, `.sidebar-panel.hidden`, `#qcm-edit-form.hidden`...). Ajouter `class="hidden"` sur un nouvel élément sans ajouter la règle CSS correspondante ne fait rien visuellement (bug rencontré et corrigé en direct sur `#signalement-panel`/`#copier-signalement-btn`, détecté seulement par un test live dans le navigateur — la classe était bien posée/retirée en JS mais sans effet visuel).
- **Ne jamais ajouter une `height`/`width` explicite "en plus" de `inset: 0` sur un élément `position: fixed`** en pensant doubler la robustesse — une hauteur explicite gagne sur celle induite par `top`/`bottom` à 0, donc si le JS doit un jour rendre `inset` négatif (déborder volontairement du viewport, ex. le flou de `#wallpaper-layer`), le débord s'applique sur un axe mais pas l'autre, silencieusement. `inset: 0` seul suffit et n'a pas ce problème. Trouvé uniquement par un test Playwright automatisé comparant `getBoundingClientRect()` au viewport — invisible à l'inspection visuelle habituelle.
- **Le piège des écouteurs accumulés sur une cible persistante s'applique aussi à `window`**, pas seulement `container`/`document` — rencontré sur `#edn-zap/:id` (éditeur de zones), où un `window.addEventListener('resize', ...)` posé naïvement à l'intérieur du `render()` interne de la page (rappelé à chaque interaction, pas seulement à chaque navigation) se serait accumulé indéfiniment. Corrigé en le posant une seule fois par navigation, hors de `render()`, avec le même principe de dédoublonnage que `tag-filter.js` (garder la référence de la fonction, `removeEventListener` avant de la reposer).
- **Un groupe de boutons radio a besoin d'un `name` partagé identique** pour que cocher l'un décoche vraiment les autres — sans lui, chaque `<input type="radio">` se comporte comme son propre groupe indépendant. Rencontré sur le rendu QRU du moteur EDN (`pages/externat/question-engine.js`) : une première version générait les radios via un helper générique sans `name`, ce qui aurait laissé cocher plusieurs "bonnes réponses" en même temps sans qu'aucune erreur ne se manifeste (juste un score toujours à 0, silencieusement).
- **Un module statiquement importé par `pages/import.js` ne doit dépendre d'aucun module chargé à la demande (zod)**, même indirectement — sinon Vite fusionne zod dans le chunk principal malgré l'`await import('../lib/import-schemas.js')` déjà en place ailleurs dans le même fichier (avertissement de build `INEFFECTIVE_DYNAMIC_IMPORT`, chunk principal +110 Ko). Rencontré en ajoutant `idFieldPourCible` (utilisée par `pages/import.js` avant même le clic sur "Importer", donc importée statiquement) directement depuis `lib/import-schemas.js`. Corrigé en sortant cette fonction (et la petite table qu'elle consulte) dans `lib/import-targets.js`, sans aucune dépendance à zod ; `import-schemas.js` la réexporte pour ne rien casser côté API existante. Toujours vérifier après un `npm run build` qu'`import-schemas-*.js` reste un chunk séparé.
- **Une popup/carte qui doit apparaître au-dessus d'un voisin `position: relative`/`sticky` a besoin que ce voisin n'ait pas involontairement créé son propre contexte d'empilement** (`isolation: isolate`, `transform`, `filter`...) — sinon même un `z-index` très supérieur sur la popup ne suffit pas à passer devant, puisque la comparaison se fait entre contextes d'empilement parents, pas entre les éléments eux-mêmes. Rencontré sur la popup de détail d'une case de heatmap (phase Externat, retours post-phase-1) : corrigé en retirant l'`isolation: isolate` posé sur le conteneur de la heatmap.
- **`isolation: isolate` n'est pas la seule façon de piéger un `z-index` dans le contexte d'empilement d'un ancêtre — `backdrop-filter` fait exactement la même chose**, et retirer l'un sans l'autre ne change rien si le second est encore là. Rencontré sur `.heatmap-popup` de l'accueil P2 (`.streak-card`, popup toujours peint SOUS la section "Matières" qui suit) : l'hypothèse initiale ciblait l'`isolation: isolate` de `.streak-card`, mais la retirer (testé en isolant la variable via Playwright) ne changeait rien — le vrai déclencheur est `[data-glass="on"] .settings-card { backdrop-filter: ... }`, qui s'applique aussi à `.streak-card` (un `.settings-card`) en mode verre dépoli et recrée le même piège. Preuve : sans mode verre, aucun bug, avec ou sans isolation ; avec mode verre, bug systématique, avec ou sans isolation. Corrigé en donnant à `.streak-card:hover`/`.streak-card.ouvert` un `z-index` explicite (5, bien en dessous des 50 de `.modal-overlay`) qui fait gagner toute la carte — popup inclus — face à la section suivante, quel que soit ce qui l'a promue en contexte d'empilement. Effet de bord découvert en corrigeant : une fois le popup effectivement au-dessus, son fond `--surface-2` (rendu translucide par le mode verre) laissait transparaître le texte de la section du dessous, net et illisible, sans le flou attendu — un `backdrop-filter` posé sur un élément DONT LE PARENT a déjà son propre `backdrop-filter` ne parvient pas à flouter ce qui est peint par un élément extérieur à ce parent (seule la translucidité s'applique). Corrigé en gardant `.heatmap-popup` hors de la liste `[data-glass="on"] ...`, avec un fond toujours opaque (`rgb(var(--surface-rgb))`) plutôt que `--surface-2`.
- **`question-engine.js` (`renderEtVerrouillerCorrection` et consorts) cible ses zones par id fixe** (`#zone-reponse`, `#correction-zone`, `#items-group`) — tout écran qui affiche plusieurs questions dans le même DOM (ex. l'écran de relecture du mode examen, `edn-examen.js`) doit reproduire ces MÊMES ids par bloc plutôt que les rendre uniques (`correction-zone-1`, `correction-zone-2`...), sinon la fonction cible silencieusement le premier bloc trouvé (ou aucun) et la correction ne s'affiche jamais sur les autres. Ça reste sûr : `container.querySelector(...)` est scopé au sous-arbre du conteneur passé, même si ça produit un document avec des ids dupliqués au sens strict du HTML. Rencontré en construisant l'écran de relecture du mode examen (lot 6), détecté par dump du HTML rendu.
- **Un accent de couleur sur un seul côté (`border-top`) posé par une classe séparée est écrasé silencieusement** dès qu'une règle avec un sélecteur combiné de même spécificité ou plus (`[data-glass="on"] .settings-card`, un `:hover` qui redéfinit `border-color`...) redéfinit `border`/`border-color` en shorthand complet : ce shorthand touche les 4 côtés, y compris celui que la classe séparée venait de personnaliser, et la spécificité (pas l'ordre dans le fichier) décide qui gagne. Rencontré sur `.settings-card-accent`/`.raccourci-tile` (`#edn-accueil`, liseré de couleur en haut des cartes/tuiles) : le mode verre dépoli effaçait la couleur (et l'épaisseur) du haut, le survol de `.raccourci-tile` aussi. Corrigé en remplaçant `border-top` par `box-shadow: inset 0 3px 0 0 var(--accent-carte, ...)` — une propriété entièrement différente, jamais touchée par un shorthand `border*`, respecte quand même le `border-radius` de la carte.
- **Une variable nommée `idsQuestions`/`idsDossiers` construite à partir d'un filtre ne veut pas dire que la requête suivante s'en sert réellement** — vérifier que le `.in('id', ...)` est bien présent, pas juste que la variable a le bon nom. Rencontré dans `resoudreCiblesEnDetail` (`lib/edn-carnet.js`) : `supabase.from('edn_questions').select(...)` (et son équivalent dossiers) n'avait jamais eu de `.in()`, malgré le nom des variables construites juste au-dessus — la fonction lisait la table ENTIÈRE à chaque affichage du carnet d'erreurs Externat, sans qu'aucune erreur ni aucun test ne le signale (le résultat final restait correct, la `map` finale ne gardant que ce qui était utilisé). Trouvé en auditant tous les usages de `.in()` du projet pour les découper par lots de 200 (voir "Lectures Supabase et pagination" plus haut), pas par un bug rapporté.
- **Une largeur fixe en `inline-block` (ex. `width: 16px` sur une "étiquette") suppose que le contenu tient toujours dans cette largeur** — sinon le texte, plus large que la boîte, se peint PAR-DESSUS ce qui suit dans le flux (la boîte garde sa largeur déclarée pour le calcul de mise en page, `overflow: visible` par défaut laisse juste le contenu déborder visuellement). Rencontré sur `.item-explication-symbole` (correction QCM, `qcm-jouer.js`/`qcm-retry-session.js`/`carnet-erreurs.js`) : pensée pour un seul caractère (`✔`, `—`), elle recevait aussi `✘ manqué`/`✘ erreur`, qui chevauchaient l'explication juste après. Élargir la largeur fixe n'aurait fait que déplacer le problème à la prochaine étiquette plus longue : corrigé en passant le `<li>` en `display: flex` avec le symbole en `flex: 0 0 auto; white-space: nowrap` et le texte regroupé dans un unique second enfant flex (`.item-explication-texte`, `min-width: 0` pour bien s'enrouler) — le symbole prend sa largeur naturelle sans jamais déborder, et les lignes suivantes d'une explication longue s'alignent sous le texte, jamais sous le symbole.
- **Historique résolu — "Déplacer ici" (`organisation.js`) vers une sous-matière ne faisait RIEN pour un cas/QCM, sans le dire** : `cas_cliniques`/`qcm` n'avaient pas de colonne `sous_matiere` (seulement `matiere` + `cours`), donc viser une sous-matière retombait silencieusement sur `{matiere: cible.racine, cours: null}` — des valeurs déjà identiques à celles de l'élément non classé, donc rien ne changeait, sans erreur ni message. Un premier correctif (message + renvoi vers "Attacher aussi ici", sans toucher au schéma) s'est révélé insuffisant à l'usage (Sullivan : "je veux vraiment pouvoir mettre directement dans la sous-matière, par exemple un sujet d'annale... ou un ED") — remplacé par la migration 002 (`sous_matiere` ajoutée à `cas_cliniques`/`qcm`) et le support complet dans `organisation.js` (index, filtrage "non classé", cascade de renommage, "Déplacer ici" qui fonctionne vraiment). Les fonctions `renommerCoursCas`/`renommerCoursQcm` ont changé de signature au passage (`(nomMatiere, sousMatiere, ancienNom, nouveauNom)`, `sousMatiere` nullable — même forme que `renommerCoursFiches`) : tout appelant existant devait être mis à jour. **Volontairement pas étendu à l'import** (`import-schemas.js`/`import.js`) : contrairement aux fiches, un cas/QCM avec un `sous_matiere` inconnu (jamais créé comme noeud réel) deviendrait invisible dans l'arbre (aucun noeud pour l'afficher dessous) — la création de sous-matière reste manuelle via Organisation, le placement se fait après coup comme avant.

## Tests

- `npm test` (vitest, mode `run`) — pour l'instant uniquement des fonctions pures, pas de jsdom/DOM : `lib/scoring.js`, `lib/escape.js`, `lib/richtext.js`, `lib/import-schemas.js`, et côté Externat `lib/edn-scoring.js`, `lib/edn-srs.js`, `lib/edn-shuffle.js`, `lib/edn-format.js`, `lib/raccourcis.js` (routes `edn-question`/`edn-dossier`).
- Échappement HTML : une seule source, `src/lib/escape.js` (`escapeHtml`, échappe `& < > " '`). Ne pas recréer de copie locale — `main.js`, `import.js` et `richtext.js` en avaient chacun une auparavant, désormais tous importent depuis `lib/escape.js`.

## Validation à l'import (`#import`)

- `src/lib/import-schemas.js` (zod) valide la forme de chaque élément collé dans `#import`, après les contrôles existants (id présent, doublons, résolution des ids déjà en base) et avant tout effet de bord (création de tags/matières/sous-matières/cours, insertion) — tout-ou-rien : une seule erreur bloque tout le lot, rien n'est inséré. `zod` est en dépendance de prod mais chargé par `await import(...)` seulement au clic sur "Importer", pour ne pas alourdir le bundle principal (vérifié : chunk séparé `import-schemas-*.js` au build).
- Un id déjà existant = mise à jour partielle (`upsertPartiel`, non modifié, toujours séquentiel et non atomique) : tous les champs deviennent optionnels mais restent validés s'ils sont présents (`ficheSchema(false)`/`casSchema(false)`/`qcmSchema(false)` vs `(true)` pour un nouvel élément).
- `contenu_structure` (fiches) et `reponse_attendue` (cas) sont validés selon le type/gabarit — `reponse_attendue` partage sa définition de gabarit (`GABARITS_CAS`) avec `lib/cas.js`, donc jamais de divergence possible avec l'affichage.
- Écarts trouvés entre les prompts (`src/data/prompts/*.md`) et le code, non tranchés, à trancher par Sullivan :
  - `prompt-matieres.md` existe mais `#import` n'a **aucune cible "matières"** (seulement fiches/cas/qcm) — ce prompt n'est donc branché sur aucun chemin d'import direct.
  - `pathologies_associees` n'apparaît que dans `prompt-fiche-clinique.md`, mais `fiche-detail.js` l'affiche pour les 3 types sans distinction — le schéma l'accepte en optionnel pour les 3 types plutôt que de le refuser pour mécanisme/structure.
  - `q.image` (image d'une question QCM, ajoutée après coup via l'upload dans `#qcm/:id`) n'apparaît dans aucun prompt — accepté en optionnel par le schéma.

## Images (upload, stockage, affichage)

- `src/lib/images.js` est le SEUL point d'upload (`televerserImage`), utilisé par le fond d'écran (`parametres.js`), les images de fiche (`[[img:...]]`, `fiche-detail.js`) et les images de question QCM (`qcm-detail.js`) — toute évolution du pipeline de compression s'applique aux trois d'un coup.
- Compression en **un seul passage, jamais itératif** : redimensionnement au plus une fois si le plus grand côté dépasse `PLUS_GRAND_COTE_MAX` (3000px — la plupart des captures d'écran réelles ne sont pas concernées), aucune deuxième passe si le résultat est "encore trop lourd". La qualité prime sur la taille de fichier (pas de plafond en octets) : une capture de cours/QCM doit rester lisible.
- Format choisi selon le type source, jamais JPEG systématique : PNG (source PNG/GIF — quasi tous les screenshots/tableaux/schémas) reste **sans perte**, pour ne jamais flouter du texte fin. JPEG/HEIC (photos) passent en WebP qualité 0.92 si le navigateur l'encode réellement (vérifié sur `blob.type`, jamais supposé — certaines versions de Safari acceptent l'appel sans erreur mais retombent sur un autre format), sinon JPEG 0.92.
- Affichage : une seule feuille de règles CSS partagée entre `.qcm-question-image img` (QCM) et `.img-toggle-content img` (fiches) — `display:block; max-width:100%; width:auto; height:auto`, jamais de `object-fit`/`max-height`/recadrage. Une image plus petite que son conteneur n'est jamais agrandie ; une image plus grande est limitée à la largeur disponible, la hauteur suit le ratio.
- Pas de transformation d'image côté Supabase (fonctionnalité payante, confirmé absent sur ce projet) : un seul fichier stocké par image, pas de variante "originale" séparée d'une variante "affichage".

### Fond d'écran (`src/lib/fond.js`, `#parametres`)

- **Cause du bug "zoomé + pixelisé" (corrigé)** : l'image de fond était posée en `background-image` de `<body>` avec `background-attachment: fixed`, peu fiable sur iOS Safari (peut calculer la taille sur le document plutôt que le viewport, notamment barre d'adresse rétractée → effet "zoomé"). Le flou était en plus "cuit" dans un canvas plafonné à 900px de large (`genererImageFloutee`, supprimée), puis ce résultat basse résolution étiré en `background-size: cover` sur tout l'écran — un second niveau de perte (upscale CSS d'une image déjà petite) qui donnait un flou pixelisé au lieu d'un flou net, **même à flou = 0**.
- **Architecture actuelle** : le fond est une couche dédiée `#wallpaper-layer` (`position: fixed; inset: 0; z-index: -1; pointer-events: none`), enfant direct de `<body>` (créée par `assurerCoucheFond()`, jamais détruite par un `render*()` qui ne touche que `#app`/`#content`). `inset: 0` (pas de `height: 100dvh` séparée en plus, voir piège ci-dessous) suffit à dimensionner la couche sur le viewport réel et à la faire déborder symétriquement quand du flou est appliqué. Le flou est un vrai `filter: blur()` CSS appliqué à cette couche (pas `CanvasRenderingContext2D.filter`, RÉELLEMENT peu fiable sur iPad, cause d'un bug différent déjà rencontré) — calculé depuis l'image pleine résolution à chaque affichage, jamais depuis une copie réduite. La couche déborde du viewport d'environ 2× le rayon de flou (`inset` négatif, JS) pour ne pas éclaircir ses bords.
- **Piège rencontré et corrigé** : une première version ajoutait `height: 100vh; height: 100dvh;` en plus de `inset: 0`, en pensant doubler la robustesse. En réalité une hauteur explicite gagne sur la hauteur induite par `top`/`bottom` à 0 sur un élément `fixed` : le débord négatif (`inset` négatif pour le flou) s'appliquait bien horizontalement mais **pas verticalement** — trouvé uniquement par un test Playwright automatisé qui comparait les dimensions réelles de la couche au viewport (`getBoundingClientRect()`), pas par inspection visuelle. `inset` seul suffit et n'a pas ce problème.
- Un essai antérieur avec un calque séparé avait rendu invisible tout texte sans carte opaque derrière lui (titres, accroche de l'accueil) — faute de `z-index` explicite. Corrigé cette fois par `z-index: -1` explicite ; revérifié en direct sur Chromium ET WebKit (Playwright, `scripts/verifier-fond-ecran.mjs`) qu'aucune régression n'est réapparue.
- **Réglages** (`fond_reglages`, table `preferences` existante — aucune nouvelle table/colonne) : mode (`cover`/`contain`/`centre`), point focal (grille 3×3, `{x,y}` en %), flou (0–20px), assombrissement (0–100 %, curseur — la luminance de l'image ne calcule plus que la valeur INITIALE lors du choix d'une nouvelle image, `assombrissementInitial()`, plus jamais recalculée automatiquement après). `resoudreReglages`/`calculerStyleFond` sont des fonctions **pures**, testées (`lib/fond.test.js`).
- Réglages séparés téléphone/ordinateur (option) : détection par `contexteAppareil()` = `matchMedia('(pointer: coarse)')` OU `matchMedia('(max-width: 768px)')` — jamais par user-agent. Un écouteur `resize` (posé une fois au chargement du module, pas dans un `render*()`) ne réapplique que si le contexte résolu a réellement changé (utile après rotation d'une tablette).
- `-webkit-backdrop-filter` : vérifié sur tout le projet, deux occurrences de `backdrop-filter` sans son pendant `-webkit-` existaient sur `.topbar`/`.mobile-tabbar` (aucun rapport avec le fond, trouvé en vérifiant systématiquement comme demandé) — corrigées.

## Mode Externat (EDN + ECOS)

Deuxième mode d'usage du site (P2 reste le mode par défaut, strictement inchangé), ajouté à
partir de `docs/externat/SPEC-EXTERNAT-V2.md` — lis ce document en entier avant de proposer un
changement dans ce périmètre, ainsi que `docs/externat/DECISIONS.md` (chaque arbitrage pris sans
demander à Sullivan y est journalisé avec le contexte et l'alternative écartée) et
`docs/externat/A-FAIRE-SULLIVAN.md` (ce qu'il doit faire lui-même, notamment appliquer les
migrations).

- **Bascule de cycle** (`lib/cycle.js`, préférence `cycle` synchronisée entre appareils, cache
  localStorage) : `'preclinique'` (défaut) ou `'externat'`, changée depuis Paramètres → carte
  "Cycle d'études" (confirmation avant bascule). Un badge discret dans la topbar (clic → ouvre
  cette carte, jamais de bascule directe au clic) rappelle le mode courant. La navigation
  (`main.js`, `appliquerNavPourCycle`) régénère nav desktop/tabbar mobile/menu selon le cycle ;
  les pages de l'autre mode restent accessibles via le menu. Une route `#edn-*`/`#ecos-*` visitée
  en mode P2 affiche un bouton pour basculer directement dessus, jamais une erreur.
- **Modèle de données** : tables préfixées `r2c_`/`edn_`/`ecos_`/`constantes_bio`, schéma complet
  dans `supabase/migrations/001_externat_fondations.sql` (RLS + policy + grants explicites,
  idempotente). Aucune table P2 n'est modifiée. `r2c_items`/`r2c_sdd` ont `numero` (entier) comme
  clé primaire, pas `id` — `lib/upsert.js` (`upsertPartiel`) accepte un paramètre `idColumn` pour
  ça. Un dossier (`edn_dossiers`, DP/KFP/TCS/LCA) porte ses questions comme de vraies lignes
  `edn_questions` (`dossier_id` + `ordre`), jamais en jsonb imbriqué comme `qcm.questions` — voir
  `lib/edn-content.js`.
- **Dégradation propre** (`lib/externat-schema.js`) : toute page externat qui tape dans une table
  pas encore migrée affiche "Migration 001 non appliquée..." au lieu de planter
  (`estTableAbsente`/`htmlMigrationManquante`, détecte les codes `42P01`/`PGRST205`).
- **Moteur docimologique** (`lib/edn-scoring.js`, fonctions pures testées contre les exemples
  officiels du cahier des charges) : 7 formats (QRU, QRM à barème par discordance, QRP/QRP_LONG,
  ZAP, QROC, TCS), rendus et joués par `pages/externat/question-engine.js` (partagé entre
  `#edn-question` et `#edn-dossier`, jamais dupliqué). Barème totalement séparé de
  `lib/scoring.js` (P2, Outremed) — ne jamais les mélanger. Le dossier applique le "no-back"
  (`resoudreRaccourci` désactive `←` sur `edn-dossier`, voir `lib/raccourcis.js`) : une question
  validée est verrouillée définitivement, jamais de bouton précédent. Les dossiers `LCA` (écran
  partagé, `#edn-dossier`) affichent une coquille persistante (`<iframe>` du texte source à gauche,
  onglets sur mobile via `data-onglet-mobile`) + zone de question qui se remplace question par
  question (`renderQuestionCourante`), jamais tout le dossier.
- **Rendu LaTeX** (`richtext.js`, `extraireFormules`/`activerKatex`) : KaTeX est chargé en lazy
  (`import()` dynamique + sa CSS), jamais dans le bundle principal — vérifier après `npm run
  build` qu'il reste dans un chunk séparé. Utilisé par `edn-question.js`/`edn-dossier.js`/
  `ecos-station.js` (ce dernier appelle aussi `activerInteractionsRichText`, oublié dans une
  première version du lot 5).
- **Constantes biologiques** (`pages/externat/constantes-modal.js`) : modale flottante
  (`#constantes-flottant-btn`/`#constantes-modal-overlay`), accessible depuis n'importe quelle page
  externat, raccourci clavier `v` (bare, voir `lib/raccourcis.js`). Cache module (`getConstantes()`)
  pour ne pas re-fetcher à chaque ouverture.
- **Mode examen** (`pages/externat/edn-examen.js`, lancé depuis `#edn-banque`) : chrono global
  unique, aucune correction avant la fin (juste "Suivant"/"Terminer l'examen"), aplati les dossiers
  choisis en unités de question individuelles taguées `origineCible` pour un enchaînement uniforme.
  L'écran de relecture (`renderRevueEtBilan`) réutilise `question-engine.js` tel quel par bloc — voir
  le piège dédié aux ids fixes plus haut. Un seul sélecteur de tags d'erreur partagé pour tout
  l'examen (`renderChoixTagsPuisEnregistrer`), puis `enregistrerToutesLesOrigines` regroupe par
  cible d'origine pour appeler `enregistrerTentative` une fois par cible (`mode:'examen'`). "Mode
  Simulateur UNESS" (option cochée au lancement) applique un thème visuel neutre isolé à cet écran
  (`.simulateur-uness` + `body:has(.simulateur-uness)`, fond d'écran/effet verre dépoli suspendus
  sans toucher le reste du site).
- **ECOS** (`lib/ecos.js`, `lib/ecos-timer.js`, `lib/ecos-scoring.js`, `lib/ecos-tentatives.js`,
  `lib/ecos-audio.js`, `pages/externat/ecos-stations.js`/`ecos-station.js`/`ecos-circuit.js`) :
  chrono de station pur et testé (8 min, repère à 7:00, alerte finale à 1:00, bip sonore via
  `AudioContext` mis en cache), grille de correction sans élimination automatique à zéro (juste
  `itemsCritiquesManques` informatif). Trois modes de jeu : solo (enregistrement audio optionnel via
  `MediaRecorder`, jamais envoyé à Supabase — reste dans le navigateur, self-assessment ensuite),
  binôme (bascule Candidat/Examinateur, layout dédié desktop `.ecos-binome-desktop` en écran
  partagé vs. onglets mobile `.ecos-binome-mobile`/`#binome-onglets`), circuit (plusieurs stations
  enchaînées, transition de 2 min entre chacune, voir `ecos-circuit.js`). `DOMAINES_ECOS` n'a que 10
  des 11 domaines officiels du CNG — le 11e reste à ajouter par Sullivan (voir
  `A-FAIRE-SULLIVAN.md`), sans contrainte en base (un domaine hors liste ne bloque rien à l'import).
- **Statistiques** (`pages/externat/edn-stats.js`, `lib/edn-stats.js`) : réussite par
  spécialité/item/format/rang docimologique, note AA estimée (`noteAAEstimee`, seuil de validation
  14/20, pondération ×2 pour une question issue d'un dossier LCA — attention à appliquer ce même
  poids partout où une moyenne pondérée est recalculée), réussite ECOS par domaine, réussite par
  heure/par durée de session (fatigue — le calcul de "pause" compare chaque tentative à la
  PRÉCÉDENTE, pas au début de la session, sinon aucune session ne peut jamais dépasser le seuil de
  pause). Exports CSV (format Anki, `lib/edn-export.js`) et PDF (`exporterErreursExternatPDF`,
  `lib/pdf.js`) limités aux questions isolées (dossiers exclus, pas de granularité par
  sous-question à ce niveau).
- **Hors-ligne / PWA** (`vite.config.js` + `vite-plugin-pwa`, `lib/offline-db.js`,
  `lib/offline-queue.js`, `lib/offline-preparer.js`) : "Préparer le hors-ligne" (tableau de bord
  Externat) télécharge du contenu dans IndexedDB pour la LECTURE seulement — ça ne fait PAS lire les
  joueurs de question/dossier depuis IndexedDB quand la connexion tombe (changement architectural
  trop large, décision explicite, voir `DECISIONS.md`). `enregistrerTentative`/
  `enregistrerTentativeEcos` détectent l'absence de réseau (`navigator.onLine` + repli sur
  `TypeError`) et mettent la tentative en file (`mettreEnFile`, IndexedDB) au lieu d'échouer ; au
  retour en ligne, `rejouerFileTentatives` réinsère chaque ligne en `upsert`
  `ignoreDuplicates:true` (idempotent) puis ne recalcule le SRS **qu'une fois par cible affectée**
  en rejouant tout son historique trié par date (`rejouerHistoriqueSrs`), jamais tentative par
  tentative — nécessaire car l'ordre/l'état intermédiaire ne sont pas fiables après une file
  hors-ligne. `offline-queue.js` ne connaît que "une table, une ligne, des ids pour le SRS", jamais
  la forme exacte d'une tentative EDN/ECOS, pour éviter un import circulaire avec
  `edn-tentatives.js`/`ecos-tentatives.js`. Indicateur `#hors-ligne-indicatif` (topbar) mis à jour
  via un évènement DOM dédié (`EVENEMENT_FILE_CHANGEE`) à chaque changement de la file, pas
  seulement sur `online`/`offline`, sinon il reste caché après une mise en file pendant que la page
  est déjà hors-ligne. **Ne jamais lancer `npm test`/`npm run build` avec un mock de
  `lib/supabase.js` encore en place** (utilisé pour les tests Playwright manuels hors-ligne) — le
  mock référence `window` au niveau module, ce qui casse vitest (pas de jsdom) sur des fichiers de
  test sans rapport ; toujours restaurer le vrai `supabase.js` avant.
- **Éditeur ZAP** (`pages/externat/edn-zap.js`, `#edn-zap/:id`) : SEULE exception au principe "pas
  de saisie de contenu dans l'UI" (des coordonnées de clic ne peuvent pas venir d'un JSON généré
  par une IA). Le rayon d'une zone est en % de la LARGEUR de l'image ; sa hauteur visuelle doit
  être recalculée selon le ratio largeur/hauteur réellement affiché pour rester un cercle (voir
  piège dédié plus haut sur l'accumulation d'écouteurs `resize`).
- **SRS** (`lib/edn-srs.js`, pur et testé) : UNIQUEMENT en mode Externat (voir "Décisions de
  conception" plus haut). Paliers J+1/3/7/14/30/60/120, 3 réussites parfaites consécutives
  requises pour un item `prioritaire` avant de passer au palier suivant (sinon retour à J+1),
  plafond anti-surcharge (réglage Paramètres, 100/jour par défaut). Mis à jour après CHAQUE
  tentative (`lib/edn-tentatives.js`, y compris en mode flash) — jamais en modifiant une ligne
  `edn_tentatives` existante (append-only, seuls les tags d'erreur s'ajoutent à l'écriture
  initiale, jamais après coup).
- **Carnet d'erreurs** : section Externat ajoutée à `pages/carnet-erreurs.js` (jamais dupliqué),
  dérivée de `edn_tentatives` sans colonne `a_revoir` dédiée (il n'y en a pas dans le schéma) — une
  cible reste "à revoir" tant que sa tentative la plus récente est imparfaite, voir
  `lib/edn-carnet.js`.
- **Session de révision** (`pages/externat/edn-session.js`) : enchaîne plusieurs cibles
  (tableau de bord "Commencer"/"Série Flash", carnet d'erreurs "Refaire ces erreurs") en
  réutilisant tel quel `#edn-question`/`#edn-dossier` (3e segment de hash `session-<mode>`),
  jamais un joueur dédié dupliqué.
- **Prompts** dans `src/data/prompts/externat/`, affichés par la page Prompts quand le cycle est
  Externat (`pages/import.js`, `promptsActuels()`). Un test (`lib/edn-prompts.test.js`) vérifie que
  l'exemple JSON de chaque prompt passe son schéma zod, comme pour les prompts P2.

## Build & déploiement

- `npm run dev` en local, `npm test` puis `npm run build` pour vérifier avant de pousser.
- Le repo GitHub public est relié à Vercel : chaque push sur `main` redéploie automatiquement.
- Pas de variables d'environnement utilisées (les clés Supabase sont en dur dans `src/lib/supabase.js`), c'est un choix assumé pour ce projet, pas un oubli.
