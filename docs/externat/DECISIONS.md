# Décisions — Mode Externat V2

Journal des arbitrages pris en autonomie pendant la phase 1 (lots 1 à 4), conformément au §2 de
`docs/externat/SPEC-EXTERNAT-V2.md` ("face à une ambiguïté, ne t'arrête pas pour demander").
Chaque entrée : contexte, option retenue, alternative écartée.

## Lot 1 — Fondations

### Nom de branche
**Contexte.** Les instructions système de la plateforme (Claude Code on the web) désignaient une
branche de session différente (`claude/sweet-einstein-pcvel4`) pour ce type de tâche.
**Retenu.** La spec (§2 et §10) nomme explicitement `externat-v2`, y compris pour la phase 2
(`externat-v2-phase2` qui en dépendra) — c'est une instruction directe et sans ambiguïté de
Sullivan dans le prompt de lancement, qui prévaut. Développé et poussé sur `externat-v2`.
**Écarté.** Rester sur la branche de session par défaut : aurait cassé la continuité attendue
entre phase 1 et phase 2, qui référence `externat-v2` par son nom exact.

### `a_corriger` / `note_correction` sur `edn_questions` en plus de `edn_dossiers`
**Contexte.** Le §7.3 ne mentionne explicitement le filtre "Signaler une erreur" que pour les
dossiers ("Pour les dossiers, filtre..."), mais la Banque liste questions ET dossiers, et le §4.2
ne prévoit pas ces colonnes sur `edn_questions`.
**Retenu.** Colonnes ajoutées aux deux tables. Une question isolée peut tout autant contenir une
erreur qu'un dossier ; ne pas pouvoir la signaler aurait été une régression d'ergonomie par
rapport aux fiches P2. Coût nul (deux colonnes booléenne/texte de plus).
**Écarté.** Se limiter aux dossiers comme le texte le laissait entendre littéralement.

### RLS : une policy unique par table, appliquée via un bloc `DO` dynamique
**Contexte.** 9 nouvelles tables, chacune ayant besoin de RLS + policy + grant identiques (accès
complet pour `authenticated`, refusé pour `anon` — même principe que l'existant, application
mono-utilisateur).
**Retenu.** Un bloc `DO $$ ... FOREACH ... $$` qui boucle sur la liste des tables plutôt que de
répéter 9 fois les 3 mêmes instructions. Idempotent via `drop policy if exists` avant chaque
`create policy` (Postgres ne supporte pas `CREATE POLICY ... IF NOT EXISTS`).
**Écarté.** Dupliquer le SQL par table : plus long, plus sujet à un oubli de grant sur une table
si le fichier est modifié à la main plus tard.

### Bascule "lien" vers le mode Externat depuis une route externat en mode P2
**Contexte.** Le §3 demande "un lien pour basculer, pas une erreur" quand on navigue vers une
route externat en mode P2.
**Retenu.** Un bouton qui appelle directement `setCycle('externat')` puis relance le routeur sur
la même route (au lieu d'un simple lien vers `#parametres`) : Sullivan arrive directement sur la
page qu'il visait, sans étape intermédiaire. Le badge topbar, lui, reste un simple raccourci vers
la carte Paramètres (pas de bascule directe au clic dessus) — cohérent avec l'exigence explicite
du §3 ("Pas de bascule au clic direct : ça évite les changements accidentels"), qui ne s'applique
qu'au badge, pas à ce bouton de récupération explicite sur une page qui n'affiche sinon rien
d'autre.

### Navigation croisée P2 ↔ Externat sur petit écran
**Contexte.** §3 : "Les pages P2 restent accessibles" en mode Externat. La tabbar mobile existante
n'a que 4 emplacements + le bouton "+" (capture) : pas la place d'afficher les deux jeux d'entrées
en même temps sans surcharger l'écran à 375px (exigence mobile-first du §1).
**Retenu.** La tabbar mobile et la nav desktop affichent les 4-5 entrées du mode courant
uniquement ; les pages de l'autre mode qui ne sont pas déjà visibles ailleurs (Entraînement, QCM,
Révision quand on est en Externat) sont ajoutées dans le menu déroulant "Menu", sous un séparateur.
Le Référentiel et le Carnet d'erreurs restent des entrées de premier niveau dans les deux modes
puisque le §3 les cite explicitely comme utiles aux deux.
**Écarté.** Un sélecteur de mode séparé de la navigation principale, ou dupliquer toute la nav des
deux modes en permanence : aurait surchargé l'écran mobile.

## Lot 2 — Référentiels et import

### `statut` de `edn_dossiers`/`edn_questions`
**Contexte.** Le §4.2 dit juste "statut : mêmes valeurs que l'existant", ambigu entre les 4
valeurs des fiches (`brouillon/valide/a_revoir/archive`) et les 3 de `cas_cliniques`/`qcm`
(`brouillon/valide/archive`).
**Retenu.** Les 3 valeurs de `cas_cliniques`/`qcm`. Le statut "à revoir" d'une fiche P2 encode un
état de révision qui, côté Externat, est déjà porté indépendamment par `edn_srs` (palier, date de
prochaine révision) — dupliquer cette information dans `statut` aurait créé deux sources de
vérité.
**Écarté.** Les 4 valeurs des fiches.

### `upsertPartiel` généralisé à une colonne clé configurable
**Contexte.** `r2c_items`/`r2c_sdd` ont `numero` (entier) comme clé primaire, pas `id` — `lib/
upsert.js` (`upsertPartiel`) codait en dur le nom de colonne `id` dans ses requêtes.
**Retenu.** Un paramètre optionnel `idColumn` (défaut `'id'`) sur `upsertPartiel`, utilisé avec
`'numero'` depuis `lib/r2c.js`. Une seule implémentation de l'upsert partiel, pas de copie
dupliquée pour ces deux tables.
**Écarté.** Une fonction d'upsert dédiée aux tables à clé entière : aurait dupliqué toute la
logique déjà testée en production de `upsertPartiel`.

### `idFieldPourCible` sorti de `lib/import-schemas.js` vers `lib/import-targets.js`
**Contexte.** `pages/import.js` a besoin de connaître, de façon synchrone et sans charger zod,
quel champ sert de clé pour chaque cible (pour les contrôles de doublon/id manquant, qui
s'exécutent avant tout import et donc avant le chargement dynamique de zod). Un premier essai
important `idFieldPourCible` directement depuis `import-schemas.js` a fait échouer la règle "zod
chargé à la demande seulement" : le build a émis `INEFFECTIVE_DYNAMIC_IMPORT` et zod s'est
retrouvé dans le chunk principal (989 Ko → 1099 Ko) au lieu de son chunk séparé.
**Retenu.** `idFieldPourCible` (et la table qu'elle consulte) vit dans un nouveau fichier sans
aucune dépendance à zod (`lib/import-targets.js`), importé statiquement par `pages/import.js` ;
`import-schemas.js` la réexporte pour ne rien casser côté tests/API existante. Le build confirme
zod de nouveau dans son propre chunk après ce changement.
**Écarté.** Dupliquer la table id/cible dans les deux fichiers (risque de divergence silencieuse).

### Questions d'un dossier stockées comme lignes réelles, pas en jsonb imbriqué
**Contexte.** `qcm.questions` est un tableau jsonb opaque ; on aurait pu faire pareil pour
`edn_dossiers`.
**Retenu.** Chaque question d'un DP/KFP/TCS/LCA est une ligne à part dans `edn_questions`
(`dossier_id` + `ordre`), éclatée à l'import par `lib/edn-content.js`. Nécessaire : le §4.3 traite
certaines cibles de révision au niveau du dossier entier mais la question reste l'unité de rendu
et de format (chaque question a son propre `format`/`rang`/`contenu`), et le lot 3 doit pouvoir
récupérer un dossier avec ses questions ordonnées sans parser un blob applicatif.
**Écarté.** `questions` en jsonb sur `edn_dossiers` comme pour les QCM.

### Détection automatique de la cible au collage : heuristique, pas garantie
**Contexte.** `detecterTypeImport` bascule déjà l'onglet actif sur la forme détectée du JSON collé
pour fiches/cas/qcm ; les nouvelles cibles ajoutent des formes qui se recoupent partiellement
(`edn_dossiers.questions` est aussi un tableau, comme `qcm.questions`).
**Retenu.** Étendu avec des heuristiques best-effort (ex. distinction par présence de
`duree_minutes`), documentées comme non garanties dans le code — Sullivan choisit toujours l'onglet
à la main si la détection se trompe, ça ne bloque jamais rien.
**Écarté.** Rendre la détection exhaustive/infaillible : coût disproportionné pour un simple
confort au collage.

### Avertissement non bloquant pour un item/SDD référencé mais pas encore importé
**Contexte.** §6 : "Les items et SDD référencés existent : avertissement non bloquant, comme pour
les matières inconnues."
**Retenu.** Même mécanisme que les matières inconnues : vérifié après validation zod, ajouté à la
liste `avertissements`, n'empêche jamais l'import. Vérifié aussi bien au niveau du dossier qu'au
niveau de chacune de ses questions imbriquées.

## Lot 3 — Moteur

_(à compléter)_

## Lot 4 — Rétention

_(à compléter)_
