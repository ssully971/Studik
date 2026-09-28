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

### Coquille du document officiel sur l'exemple QRP
**Contexte.** §5.4 : l'exemple officiel donne "{1,3,5} → 1 pt (2/2)" alors que le calcul (3
propositions vraies/indispensables cochées sur n=3) donne 3/3 = 1.
**Retenu.** Implémenté et testé comme 3/3 = 1 (la valeur numérique du score, 1, est de toute façon
la même que celle du document officiel — seule l'annotation "(2/2)" entre parenthèses est
incohérente avec l'énoncé). Testé explicitement dans `edn-scoring.test.js` avec un commentaire
renvoyant ici.
**Écarté.** Reproduire une éventuelle règle cachée qui expliquerait "(2/2)" : aucune ne se déduit
du reste du document, plus probablement une coquille de relecture du document source.

### Couleurs de correction propres au moteur EDN, distinctes de qcm-jouer.js
**Contexte.** §5.10 demande "vert = coché juste ; rouge = coché faux ; neutre (bleu/gris) = vrai
non coché. Réutilise les classes de correction de qcm-jouer.js si elles existent." Mais la classe
"manqué" de qcm-jouer.js (`item-explication-missed`) est ocre (`var(--mecanisme)`), pas bleu/gris.
**Retenu.** Nouvelles classes `edn-prop-ok`/`edn-prop-wrong`/`edn-prop-neutre` (bleu/gris via
`var(--structure)`), qui reprennent la même STRUCTURE de distinction (juste/faux/neutre) que
qcm-jouer.js sans copier une couleur qui contredirait la spec.
**Écarté.** Réutiliser telles quelles les classes `item-explication-*` : couleur incompatible avec
la demande explicite.

### Récapitulatif d'une tentative de dossier = une seule ligne `edn_tentatives`
**Contexte.** §4.3 : l'unité de révision d'un DP/KFP/TCS est le dossier entier, pas chacune de ses
questions.
**Retenu.** `edn-dossier.js` calcule le score de chaque question au fil de l'eau (verrouillage
immédiat, no-back) mais n'enregistre qu'UNE tentative à la toute fin (`cible: 'd:<id>'`,
`detail` = tableau des scores par question). Le SRS (lot 4) portera donc sur le dossier entier,
pas sur ses sous-questions.
**Écarté.** Une ligne `edn_tentatives` par question d'un dossier : aurait rendu le SRS incohérent
avec la règle du no-back (§4.3, "on ne révise pas une question de DP hors de son dossier").

### Comptage double des questions de LCA : reporté aux statistiques (lot 7), pas à la notation brute
**Contexte.** §5.10 : "Les questions de LCA comptent double dans les statistiques, comme à
l'officiel."
**Retenu.** `scoreDossier`/l'enregistrement de la tentative restent une somme simple (poids 1 par
question) ; le facteur ×2 pour les LCA s'appliquera au moment de l'agrégation en statistiques
(lot 7), pas dans `edn_tentatives.detail` ni dans le score brut stocké. Séparer la donnée brute
(ce qui s'est réellement passé) de sa pondération à l'affichage évite de devoir choisir a priori
"double de quoi" (score déjà su à l'écriture vs. pondération recalculable à tout moment).
**Écarté.** Multiplier le score par 2 dès l'enregistrement pour un dossier LCA.

### LCA hors périmètre du lot 3
**Contexte.** §8 place explicitement "LCA (écran partagé)" dans le lot 6 (phase 2), pas le lot 3.
**Retenu.** `edn-dossier.js` affiche un message "arrive au lot 6" pour `dossier.type === 'LCA'`
plutôt que d'improviser un rendu minimal non spécifié (l'écran partagé desktop/onglets mobile est
une exigence d'interface à part entière, pas un simple réglage).

### ZAP : seule la forme "cercle" est implémentée
**Contexte.** §5.6 : "Formes : cercle obligatoire. rect... optionnel si c'est simple à ajouter."
**Retenu.** Seul "cercle" est géré par l'éditeur (`edn-zap.js`) et le rendu de correction — le
moteur de score (`zoneToucheeParClic`) sait déjà gérer "rect" (testé), donc l'ajouter à l'éditeur
plus tard n'impliquera aucune refonte du calcul.
**Écarté.** Ajouter "rect" maintenant : aurait demandé une interaction d'édition supplémentaire
(glisser pour définir un rectangle) non couverte par le temps disponible sur ce lot.

### Événements pointer aussi bien dans le joueur ZAP que dans l'éditeur
**Contexte.** §5.6 n'exige les événements pointer explicitement que pour l'éditeur ("Elle doit
fonctionner au doigt, avec les événements pointer").
**Retenu.** Le joueur (`question-engine.js`) écoute aussi `pointerup` plutôt que `click` sur
l'image ZAP, par cohérence et pour la même fiabilité tactile — c'est le même geste (poser un
point), aucune raison qu'il se comporte différemment entre édition et jeu.

### `ajusterScoreQroc` ne peut jamais faire baisser le score automatique
**Contexte.** §5.7 : le bouton "Ma réponse était juste / acceptable" rectifie un score jugé trop
sévère par la comparaison textuelle automatique.
**Retenu.** `ajusterScoreQroc(scoreAuto, 'acceptable')` renvoie `Math.max(scoreAuto, 0.5)` : si
l'automatique avait déjà donné 1 (exact), cliquer "acceptable" par erreur ne le fait pas
redescendre à 0,5. Le bouton est un filet de sécurité à la hausse, jamais un moyen de se pénaliser
par erreur de clic.

### Flake pré-existant observé dans `raccourcis.test.js` (non lié à ce lot)
**Contexte.** Le test "absence de collision dans un même contexte" (déjà présent avant la phase
Externat) appelle deux fois `resoudreRaccourci` avec `maintenant: Date.now()` implicite pour
vérifier la stabilité du résultat ; la touche "g" produit `{ type: 'sequence-start', expireAt:
maintenant + 1000 }`, et les deux appels peuvent, très rarement, tomber de part et d'autre d'une
frontière de milliseconde et donc différer d'1 ms. Observé une fois sur plusieurs dizaines
d'exécutions pendant ce lot, jamais reproduit en isolant ce seul fichier.
**Retenu.** Ne pas corriger : ce test et son défaut existaient avant cette phase, aucune ligne
listée dans le §8 ne demande d'y toucher, et le corriger reviendrait à modifier un test hors du
périmètre "moteur" de ce lot sans que Sullivan l'ait demandé. Signalé ici pour transparence.

## Retours de Sullivan après test sur l'aperçu Vercel réel (post-lot 4)

### Sélecteur de période P2 visible en mode Externat (bug)
**Contexte.** Le sélecteur "Toutes les périodes" (années/semestres de `matieres`, P2 uniquement)
restait affiché et fonctionnel dans la topbar même en mode Externat.
**Corrigé.** `appliquerVisibilitePeriodeSelect()` (main.js) le masque dès que `estExternat()`, et
réapplique la règle à chaque changement de cycle (pas seulement au chargement initial).

### Contenu P2 dans le Référentiel/Carnet d'erreurs en mode Externat : gardé, mais togglable et étiqueté
**Contexte.** Ces pages restant accessibles en Externat est un choix explicite du §3 de la spec.
Sullivan a confirmé vouloir les garder accessibles, mais avec un bouton pour les
activer/désactiver et un étiquetage clair quand affichées.
**Retenu.** Nouvelle préférence `afficher_p2_en_externat` (`lib/cycle.js`, synchronisée entre
appareils comme `cycle`, défaut `true`) réglable via une case à cocher dans Paramètres → carte
"Cycle d'études" (visible seulement en mode Externat). Quand désactivée : l'entrée "Référentiel"
disparaît de la nav/tabbar/menu Externat, et les sections "Cas cliniques"/"QCM" du Carnet
d'erreurs (contenu P2) sont masquées — leur fetch est même sauté entièrement, pas juste caché en
CSS. Quand activée (défaut) : ces entrées/sections restent visibles mais étiquetées "(P2)"
partout (nav, titres de section) pour ne jamais laisser croire que c'est du contenu Externat natif.
**Écarté.** Les masquer par défaut : le choix initial de la spec (rester utile en Externat) reste
le comportement par défaut, seulement rendu réversible.

### Page Stats et "matières" Externat : aucun changement demandé
**Contexte.** Sullivan a confirmé ne rien vouloir de plus maintenant sur les statistiques
(le lot 7/phase 2 reste le bon moment) ni sur une éventuelle table de "spécialités Externat"
dédiée (le texte libre actuel sur les questions/dossiers suffit).
**Retenu.** Aucun changement de schéma ni de page Stats dans cette session.

### Page Prompts : bandeau de cycle + README propre à l'Externat
**Contexte.** Sullivan trouvait les prompts "pas assez séparés visuellement" entre P2 et Externat
sur l'aperçu — alors que le contenu des prompts eux-mêmes changeait déjà bien selon le cycle
(`promptsActuels()`).
**Retenu.** Un bandeau "Banque de prompts — P2/EXTERNAT" (badge réutilisant `.cycle-badge`) en
haut de la page Prompts, ET un nouveau `README-prompts-externat.md` distinct du README P2 pour la
carte "Comment ça marche" (qui listait encore les fichiers P2 même en mode Externat — trouvé en
vérifiant le rendu réel, pas seulement le contenu des prompts eux-mêmes).
**Écarté.** Deux routes séparées (`#import` vs `#edn-import`) : plus de duplication de code pour
un gain marginal, le bandeau suffit à lever l'ambiguïté visuelle signalée.

## Lot 4 — Rétention

### Carnet d'erreurs Externat sans colonne `a_revoir`
**Contexte.** `edn_tentatives` (§4.3) n'a pas de colonne équivalente à `cas_cliniques.a_revoir` /
`qcm_tentatives.a_revoir`, et est explicitement append-only ("seuls les tags d'erreur peuvent
être ajoutés").
**Retenu.** La section Externat du carnet d'erreurs dérive la liste "à revoir" en mémoire : pour
chaque `cible`, on garde sa tentative la plus récente et on l'affiche seulement si son score est
imparfait (même principe que `getTentativesRatees()` côté P2, qui fait déjà ce calcul en dédupliquant
par `cas_id` — juste sans colonne stockée à mettre à jour). Une nouvelle tentative réussie fait
disparaître la cible de la liste automatiquement, sans muter une ligne existante.
**Écarté.** Ajouter une colonne `a_revoir` à `edn_tentatives` : aurait contredit l'invariant
append-only explicite de la spec, et aurait dupliqué une information déjà déductible.

### Tag d'erreur d'un dossier choisi une seule fois, à la fin, pas question par question
**Contexte.** §7.4 dit "après une question ratée (s<1)", ce qui pourrait suggérer un tag par
question, mais un dossier ne produit qu'UNE tentative (`edn_tentatives.tags_erreur` est un seul
tableau par ligne, décision du lot 3).
**Retenu.** Dans `#edn-dossier`, si au moins une question du dossier est imparfaite et qu'on est en
mode entraînement, l'écran de fin (avant l'enregistrement définitif) demande les tags d'erreur une
seule fois pour tout le dossier, obligatoires comme prévu.
**Écarté.** Interrompre chaque question ratée individuellement pour choisir un tag : aurait cassé
le rythme du no-back et ne correspond à aucune colonne existante pour les stocker séparément.

### Mode "session" pour enchaîner plusieurs cibles : un 3e segment de hash, pas un joueur dédié
**Contexte.** Le tableau de bord (Révisions dues, Série Flash) et le carnet d'erreurs ("Refaire ces
erreurs") doivent enchaîner plusieurs cibles hétérogènes (questions isolées ET dossiers) sans
dupliquer tout le moteur de jeu.
**Retenu.** `pages/externat/edn-session.js` garde une file de cibles en mémoire de module (même
principe que `qcm-retry-session.js` côté P2) et redirige successivement vers `#edn-question/:id/
session-<mode>` ou `#edn-dossier/:id/session-<mode>` : `#edn-question`/`#edn-dossier` lisent ce 3e
segment (`analyserContexteJeu`) pour savoir qu'ils doivent avancer la session au lieu de renvoyer
vers la Banque, et pour connaître le mode (`entrainement`/`flash`, qui décide si le tag d'erreur
est obligatoire). Zéro duplication du rendu de question/dossier.
**Écarté.** Un troisième joueur unifié qui saurait jouer indifféremment une question ou un dossier
dans un seul écran : plus de code pour un gain d'UX marginal (une transition de page entre deux
cibles d'une session est un coût négligeable).

### Raccourcis du tableau de bord simplifiés en liens directs
**Contexte.** §7.2 décrit des "Raccourcis" avec filtres riches (spécialité, item, SDD, rang,
format, source, tags, "jamais faites", "ratées") pour lancer une série de questions isolées ciblée.
**Retenu.** Le tableau de bord expose des liens directs vers Banque/ECOS/Erreurs/Items R2C/
Référentiel ; le filtrage fin se fait dans `#edn-banque` elle-même (qui a déjà spécialité/item/
statut/tags/suspendues/à corriger). Construire un lanceur de série dédié avec la totalité des
critères listés aurait représenté une fonctionnalité à part entière.
**Écarté.** Un composant de lancement de série multi-critères dédié sur l'accueil — noté ici comme
amélioration possible d'une phase suivante, pas oublié par erreur.

### Carte "Série" simplifiée plutôt que le composant riche de l'accueil P2
**Contexte.** §7.2 : "Le streak existant reste affiché, avec le même fonctionnement."
**Retenu.** Le tableau de bord Externat réutilise directement `computeStreak`/`checkinAujourdhui`/
`getCheckins` (mêmes données, même définition de série) dans une carte simple (texte + bouton),
plutôt que de dupliquer la carte dépliable avec heatmap de `pages/accueil.js` (qui n'est pas
exportée en composant réutilisable). Le "même fonctionnement" du streak lui-même (calcul, check-in)
est strictement identique ; seule la présentation est allégée.
**Écarté.** Extraire `pages/accueil.js` en composant partagé pour cette seule carte : aurait
touché du code P2 stable pour un gain cosmétique, contraire à "zéro régression sur le mode P2" en
ajoutant un risque évitable.

### Accueil par défaut (hash vide) rendu cycle-aware après un test visuel réel
**Contexte.** Un aller-retour avec un navigateur réel (captures d'écran demandées après coup par
Sullivan) a montré qu'une visite sans hash (`http://.../`) atterrissait toujours sur l'accueil P2
même en mode Externat : `router()` et le raccourci "g h" avaient `'accueil'` codé en dur comme
route par défaut, indépendamment du cycle.
**Retenu.** `routeAccueilParDefaut()` (nouveau, `main.js`) renvoie `'edn-accueil'` ou `'accueil'`
selon `estExternat()`, utilisée à la fois par `router()` (hash vide) et par `executerRaccourci`
(qui traduit la cible littérale `'#accueil'` de la séquence `g h` — `lib/raccourcis.js` reste pur
et ignore le cycle par conception, la traduction se fait à la couche qui touche le DOM). Corrigé
avant la relecture de la PR, pas après.
**Écarté.** Rendre `SEQUENCE_G`/`resoudreRaccourci` cycle-aware directement : aurait fait
dépendre un module pur et testé du contexte applicatif, pour un seul cas d'usage.

### Réglages Externat (plafond SRS, tags d'erreur) dans une carte Paramètres visible seulement en mode Externat
**Contexte.** §7.1 et §7.4 placent ces réglages "dans Paramètres, section externat" / "modifiable
dans Paramètres".
**Retenu.** Une carte visible uniquement quand `estExternat()` (comme la logique de navigation),
avec un plafond numérique et une liste de tags en zone de texte (une ligne = un tag, même
principe que les listes une-ligne-un-élément déjà utilisées ailleurs sur le site).
**Écarté.** Un sélecteur de tags plus élaboré (chips avec ajout/suppression individuels) : la zone
de texte suffit pour une liste courte gérée par un seul utilisateur.

## Retours de Sullivan après import réel des référentiels R2C (367 items + 356 SDD)

### Bug UX signalé : aucun retour visuel pendant l'import sur `#import`
**Contexte.** Après avoir collé le JSON des 367 items puis des 356 SDD dans `#import` et cliqué
sur "Importer", rien ne s'affiche pendant le traitement (le bouton ne change pas d'état, aucun
spinner/texte de progression) — seul le message final ("tout est validé"/erreur) apparaît, ce qui
peut faire croire que le clic n'a rien fait sur un lot de cette taille.
**Statut.** Signalé par Sullivan, explicitement mis de côté pour l'instant ("Garde ça pour le lot
2") : pas corrigé dans cette session. **Reste à faire** : ajouter un indicateur de chargement
(désactiver le bouton + libellé "Import en cours..."/spinner) sur `renderModePrompts`/le handler
de clic d'`#import` (`src/pages/import.js`), le temps du traitement zod + upsert séquentiel.
**Écarté (pour l'instant).** Corriger immédiatement : demande explicite de reporter ce point.
