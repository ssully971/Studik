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

### Élargi : absence générale de retour visuel pendant le chargement (pas seulement `#import`)
**Contexte.** Même remarque étendue par Sullivan à d'autres écrans Externat (ex. listes qui vont
chercher des données Supabase) : aucun état de chargement visible (pas de skeleton/spinner), un
écran peut sembler figé le temps de la requête.
**Statut.** Regroupé avec le point ci-dessus, reporté au lot 2. **Reste à faire** : introduire un
état de chargement visuel simple et réutilisable (skeleton ou spinner léger, cohérent avec
l'identité visuelle noir OLED/Lora/IBM Plex) pour les écrans Externat qui vont chercher des
données avant affichage (`#import`, listes `#edn-banque`/`#edn-items`, tableau de bord), pas un
correctif isolé au seul bouton d'import.
**Écarté (pour l'instant).** Corriger immédiatement : reporté au même titre que le point ci-dessus.

## Retours de Sullivan après test complet de la phase 1 (navigation, banque, ZAP, import)

### Corrigé maintenant : le popup heatmap de `#accueil` (P2) pouvait finir mal empilé par rapport au texte suivant
**Contexte.** Signalé : "la heatmap se retrouve sous le texte des matières alors que c'est censé
superposer le tout". Vérifié en direct (Playwright, `#accueil` en P2, `.streak-card` survolée) :
`.streak-card` a `position: relative` mais **n'établit pas de contexte d'empilement** à lui seul
(il faut `position` + un `z-index` autre que `auto`, ou une propriété comme `isolation`) — le
`z-index: 5` de `.heatmap-popup` se retrouvait donc évalué dans le contexte d'empilement du
premier ancêtre qui en établit un (potentiellement bien plus haut que `.streak-card`), ce qui rend
l'empilement final dépendant de tout le reste de la page au lieu d'être garanti localement. Le
test headless montre que Chromium retombait sur ses pieds (le popup masquait bien le titre
"Matières" suivant), mais ce n'est pas une garantie sur tous les moteurs/contextes — d'où le rendu
inversé constaté par Sullivan sur son propre appareil.
**Retenu.** `.streak-card` reçoit `isolation: isolate` (crée un contexte d'empilement dédié, sans
changer le layout) ; `.heatmap-popup` passe de `z-index: 5` à `z-index: 20` par marge de sécurité.
Le popup est désormais garanti au-dessus de tout ce qui suit `.streak-card`, quel que soit le
reste de la page. `npm test`/`npm run build` toujours verts après ce changement CSS pur.
**À confirmer par Sullivan** sur son appareil réel — je n'ai pas pu reproduire à l'identique le
sens exact du bug signalé, seulement l'ambiguïté d'empilement qui le permettait.

### Reporté phase 2 : Banque (`#edn-banque`) — pas de tri, pas d'enchaînement en série
**Contexte.** "Il n'y a pas de quoi trier les questions... je dois forcément taper dans la barre
de recherche. Et je n'ai pas moyen de les faire à la chaîne, faut que je tape un par un." Vérifié
dans le code (`pages/externat/edn-banque.js`) : filtres actuels = recherche texte, type
(dossier/question), statut, à corriger, suspendues du SRS — aucun tri (alphabétique/date/format),
et aucune action pour lancer une session sur le résultat filtré (seul un clic ouvre une question
à la fois). Rejoint un point déjà noté plus haut ("Carte 'Série' simplifiée...") : le lanceur de
série multi-critères avait été explicitement écarté de la phase 1, remis en jeu ici.
**Statut.** Reporté à la phase 2. **Reste à faire** : (a) un tri sur `#banque-list` (au moins
alphabétique et par statut) ; (b) un bouton "Lancer une session sur ces résultats" qui réutilise
`pages/externat/edn-session.js` (déjà conçu pour enchaîner plusieurs cibles) avec la liste
filtrée courante comme scope, sur le même principe que "Refaire ces erreurs" du carnet.
**Écarté (pour l'instant).** Implémenter tout de suite : périmètre trop large pour un correctif
isolé (nouvelle entrée dans le moteur de session), à faire avec le reste de la phase 2.

### Reporté phase 2 : aucun retour visuel au clic sur une question/dossier en attendant le chargement
**Contexte.** "J'appuie sur une question, et ça ne fait rien tant que ce n'est pas chargé."
Rejoint et précise le point "absence générale de retour visuel pendant le chargement" déjà noté
ci-dessus (skeleton/spinner) — s'applique en particulier au clic sur une ligne de `#edn-banque`
vers `#edn-question/:id`/`#edn-dossier/:id`.
**Statut.** Regroupé avec le mécanisme de chargement déjà prévu pour la phase 2 (même solution
technique : indicateur visuel réutilisable), pas un correctif séparé.

### Reporté phase 2 : image ZAP attachable directement depuis l'import
**Contexte.** "Ce serait bien que directement depuis l'import on puisse mettre les photos [ZAP]
car importer puis retourner dans la banque pour corriger ça, ça fait beaucoup." Actuellement
`prompt-edn-zap.md` importe l'énoncé seul (`zones: []`, aucune image) — l'image est téléversée
ensuite dans l'éditeur `#edn-zap/:id`, en repassant par la banque pour la retrouver.
**Statut.** Reporté à la phase 2 : `#import` est un import JSON texte (paste), pas un formulaire
avec upload de fichier — attacher une image au moment de l'import est un changement de flux (pas
juste un ajout de champ), à concevoir avec Sullivan (un seul item à la fois ? plusieurs ? avant ou
après validation du JSON ?) plutôt qu'à trancher seul.

### Reporté phase 2 (P2, hors périmètre Externat mais noté ici pour ne pas le perdre) : popup "importer des photos ?" après import d'un QCM
**Contexte.** "Si je fais un QCM de P2, ce serait bien qu'après l'import une petite popup me
demande si je veux importer des photos, et si oui pour quelle(s) question(s)." Aujourd'hui
`q.image` (voir CLAUDE.md, section Validation à l'import) se rajoute uniquement après coup, à la
main, dans `#qcm/:id`. Même besoin que le point ZAP ci-dessus (attacher une image tout de suite
après un import), mais côté P2 — les deux gagneraient à partager la même solution technique.
**Statut.** Reporté, à concevoir en même temps que le point ZAP ci-dessus (mécanisme commun
d'upload post-import), pas un correctif isolé.

### Reporté phase 2 : questions isolées jamais regroupées en série jouable
**Contexte.** "Quand je fais une liste de qcm [questions isolées], il n'y a aucun endroit où ils
sont regroupés. Chaque question est seule, il n'y a pas moyen de les faire une par une [à la
suite]." Même besoin que le point "Banque — pas d'enchaînement en série" ci-dessus : une session
lancée depuis un ensemble filtré de `#edn-banque` couvrirait aussi ce cas (les questions isolées
en résultat de filtre).
**Statut.** Fusionné avec le point Banque ci-dessus, pas un chantier séparé.

### Reporté phase 2 : `#import` — replier "Tags de référence" et "Comment ça marche" par défaut
**Contexte.** "Ce serait bien que les tags et le 'comment ça marche' soient enroulés par défaut,
et qu'il faille appuyer dessus pour les dérouler, car ça prend de la place."
**Statut.** Reporté. **Reste à faire** : rendre ces deux cartes de `renderModePrompts`
(`src/pages/import.js`) repliables (fermées par défaut, bouton/en-tête cliquable pour déplier),
même mécanisme que les autres sections repliables déjà présentes sur le site (ex. carte streak).

### Reporté phase 2 : raccourci clavier pour basculer entre Import et Prompts
**Contexte.** "Ce serait bien un raccourci pour switch entre l'import et les prompts si je dois
générer à la chaîne."
**Statut.** Reporté — à intégrer dans `lib/raccourcis.js`/`resoudreRaccourci` (fonction pure et
testée, voir section Raccourcis clavier de CLAUDE.md) plutôt que branché à la main dans
`import.js`, pour rester cohérent avec le reste du système de raccourcis.

### Rappel transverse : les correctifs communs P2/Externat (chargement, upload post-import) doivent s'appliquer aux deux modes
**Contexte.** "Les éléments communs à P2 et externat, faut appliquer les changements [de ce type]
dans le lot 2 [phase 2]." Rappel explicite de Sullivan : les mécanismes partagés entre les deux
modes (indicateur de chargement, popup d'upload post-import) doivent être conçus une seule fois et
réutilisés par les deux modes, jamais dupliqués/divergents entre P2 et Externat.
**Retenu.** Noté ici comme contrainte de conception pour la phase 2, à relire avant de commencer
ces chantiers (indicateur de chargement déjà écrit comme "réutilisable" plus haut ; le mécanisme
d'upload post-import ZAP/QCM est explicitement designé comme un point commun ci-dessus).

## Phase 2 — intégration des retours de la phase 1 (branche `externat-v2-phase2`)

PR #1 fusionnée dans `main` sur demande explicite de Sullivan ("Merge pour lancer la phase 2").
Avant les lots 5 à 8, les points suivants (notés ci-dessus) ont été traités :

- **Chargement visuel réutilisable** : découverte en relisant le code qu'un composant existait
  déjà et correspondait exactement au besoin — `lib/loader.js` (`afficherLoader`), le loader
  "Feuillet" utilisé au démarrage de l'app, dont le commentaire d'origine dit explicitement qu'il
  est "pensé... pour toute transition de route un peu longue". **Retenu** : réutilisé tel quel
  (aucune duplication) sur `#edn-banque`, `#edn-question`, `#edn-dossier` (remplace le `<p
  class="voice">Chargement…</p>` par `afficherLoader(container)`, avec `arreterLoader()` appelé
  sur chaque chemin de sortie — succès et erreur — pour ne pas laisser tourner le `setInterval`
  dans le vide une fois le contenu réel affiché). Un petit `.spinner` CSS séparé a été ajouté pour
  le cas différent du bouton d'import (le loader "Feuillet" est plein écran, inadapté à un bouton).
  **Écarté** : créer un deuxième mécanisme de chargement — le composant existant couvrait déjà le
  besoin, l'occasion de le réutiliser plutôt que d'empiler un système parallèle.
- **`#import` : bouton "Importer" avec état de chargement.** Le clic déclenche désormais
  `importBtn.disabled = true` + spinner + libellé "Import en cours…", restauré dans un `finally`
  qui couvre tous les chemins de retour existants (le corps du traitement a été extrait dans une
  fonction interne `importerLot()` pour pouvoir l'entourer d'un seul `try/finally` sans dupliquer
  chaque `return`).
- **`#edn-banque` : tri + lancer une session.** Ajout d'un `<select>` de tri (titre/statut/format)
  et d'un bouton "Lancer une session sur ces résultats" qui appelle `demarrerSessionExternat`
  (`edn-session.js`, déjà conçu pour enchaîner plusieurs cibles) avec la liste actuellement
  filtrée — couvre à la fois la demande "trier" et "enchaîner sans re-cliquer à chaque question",
  y compris pour les questions isolées seules (même mécanisme, pas de chantier séparé).
- **`#import` : cartes "Tags de référence"/"Comment ça marche" repliées par défaut.** Converties en
  `<details class="settings-card"><summary>...` — repli natif du navigateur, aucun JS
  supplémentaire, CSS ajoutée pour que le `<summary>` garde le même poids visuel que l'ancien
  `<h3>`.
- **Raccourci clavier `t`** (page `#import` uniquement) : bascule Import ↔ Prompts, résolu dans
  `lib/raccourcis.js` (testé) plutôt que branché à la main dans `import.js`, cohérent avec le reste
  du système de raccourcis — clique sur un nouveau bouton visible `#import-toggle-btn` (même
  principe que les autres raccourcis : `.click()` sur un id stable).

**Toujours reporté** (décision de conception à prendre avec Sullivan avant de coder, pas un simple
oubli) : l'upload d'image directement depuis l'import (ZAP + popup QCM P2) — nécessite de changer
la nature de `#import` (aujourd'hui un paste JSON texte pur) pour y intégrer un upload de fichier,
ce qui dépasse le cadre d'une intégration de retours et mérite d'être découpé en sous-lot à part
entière plutôt que fait rapidement en même temps que le reste.

`npm test` (418 tests, +3 pour le raccourci `t`) et `npm run build` verts après ce lot.

## Lot 5 — ECOS

- **Chronomètre unique réutilisé pour station (8:00) et transition de circuit (2:00)**
  (`lib/ecos-timer.js`, pur, testé). **Retenu** : une seule machine à états paramétrée par
  `dureeTotaleS`, jamais deux implémentations. Le repère de lecture (7:00 restantes) et l'alerte
  finale (1:00 restante) sont des constantes absolues appliquées seulement quand `etat ===
  'en_cours'` — jamais évaluées sur un chrono "pret" ou "termine".
- **Pas de zéro éliminatoire automatique** (§5.9 : "aucune source officielle trouvée"). **Retenu**
  : `scoreGrille` (lib/ecos-scoring.js) additionne simplement les points des items cochés, sans
  aucune règle spéciale sur 0/100 — confirmé volontairement, pas un oubli.
- **Bouton "Terminer maintenant"** ajouté sur l'écran de jeu (absent de la spec, mais permet de
  quitter le chrono avant la fin naturelle — utile pour s'entraîner sur une partie seulement d'une
  station, ou en cas d'erreur). **Écarté** : forcer les 8 minutes complètes systématiquement,
  contraignant sans bénéfice évident en dehors des conditions d'examen réelles (lot 6).
- **`DOMAINES_ECOS`** (`lib/ecos.js`) ne liste que 10 des 11 domaines du guide CNG — le 11e reste
  inconnu (voir A-FAIRE-SULLIVAN.md). Liste purement indicative pour le filtre de `#ecos-stations`,
  pas une contrainte en base (le schéma §4.4 a toujours `domaine text`, sans `check`) : un domaine
  hors liste reste importable sans erreur, cohérent avec le principe déjà appliqué à `tags`.
- **Mode binôme sur un seul appareil** : bascule par onglets sur mobile (`<button data-onglet>`),
  écran partagé en CSS grid 2 colonnes à partir de 860px (même seuil que `.fiche-layout`, §CLAUDE.md
  "Décisions de conception") — jamais les deux affichages en même temps dans le DOM visible, la
  grille de l'examinateur reste la même instance HTML des deux côtés du breakpoint (pas de
  duplication de logique de cochage).
- **Enregistrement audio (`MediaRecorder`) strictement en mémoire** : `URL.createObjectURL`, jamais
  de upload Supabase (quota 1 Go, §9). Une permission micro refusée désactive silencieusement
  `enregistrerAudio` plutôt que de bloquer le démarrage de la station — l'audio est un bonus, pas
  une condition pour jouer.
- **Circuit lancé depuis `#ecos-stations`** via des cases à cocher par ligne + bouton "Lancer un
  circuit (N)" (`lib/ecos-circuit.js`, même principe que `edn-session.js`) — l'ordre de sélection
  (un `Set`, qui conserve l'ordre d'insertion en JS) devient l'ordre du circuit, pas un tri
  alphabétique ou par date qui serait moins prévisible pour l'utilisateur qui choisit lui-même.
- Testé en direct (Playwright + mock Supabase) : liste → choix de mode → chrono qui décroît
  réellement (Date.now(), pas un compteur décrémenté) → révélation solo → auto-pointage → score
  correct → mode binôme desktop (2 colonnes) et mobile (onglets) → circuit complet sur 2 stations
  (transition, avance, dernière station termine le circuit et revient à la liste). Aucune régression
  détectée, `npm test` (440 tests, +22 pour ecos-timer.js/ecos-scoring.js) et `npm run build` verts.

## Lot 6 — Conditions d'examen

### KaTeX (§5.11), jamais fait en phase 1
**Contexte.** §5.11 prévoyait KaTeX dès le lot 3, avec repli explicite vers le lot 6 "si ça
complique trop le build". Relecture de `DECISIONS.md`/`CLAUDE.md` : aucune trace de KaTeX ni de
décision de le reporter — un oubli pur et simple de la phase 1, pas un report consigné. Corrigé
maintenant plutôt que signalé comme dette supplémentaire.
**Retenu.** `richText()` (lib/richtext.js) extrait `$$...$$`/`$...$` en jetons neutres **avant**
le reste du pipeline (comme les images), pour deux raisons : un `|` dans une formule (valeur
absolue `$|x|$`) ne doit pas être pris pour une colonne de tableau, et le LaTeX brut ne doit pas
subir les autres transformations (`**gras**` etc.) avant d'atteindre KaTeX. Le rendu réel
(`activerKatex(scopeEl)`) est une fonction séparée, appelée après la pose du HTML dans le DOM —
`richText()` reste synchrone, `katex` + sa CSS ne sont chargés (`await import(...)`) que si au
moins un `.katex-pending` existe réellement dans le scope (vérifié au build : chunk `katex-*.js`
~260 Ko séparé, +2 Ko seulement sur le bundle principal).
**Écarté.** Rendre `richText()` asynchrone pour intégrer katex directement : aurait cassé son
usage synchrone dans un template literal sur une dizaine d'appels existants, pour un gain nul.

### Bug trouvé en passant : ecos-station.js oubliait `activerInteractionsRichText`
**Contexte.** En ajoutant `activerKatex` à chaque appelant de `richText()`, découverte que
`ecos-station.js` (lot 5) appelait `richText()` pour la vignette/les consignes/le script mais
n'appelait jamais `activerInteractionsRichText` — le bouton "Afficher l'image" et le masquage des
normes d'un éventuel tableau y étaient donc silencieusement inertes.
**Statut.** Corrigé dans ce commit (un seul appel ajouté, au même endroit que `activerKatex`).

### Joueur LCA (§5.10) : même moteur que DP/KFP/TCS, coquille à écran partagé qui ne remplace que la colonne questions
**Contexte.** §5.10 : "Desktop : article à gauche (iframe ou `<object>`...), questions défilantes
à droite. Mobile : onglets Article/Questions." Le stub du lot 3 renvoyait juste un message
d'attente ; `edn-dossier.js` gérait déjà tout le reste (no-back, verrouillage, tag d'erreur, score,
résumé) pour DP/KFP/TCS.
**Retenu.** Extraction de la carte "question courante" dans `zoneQuestionHTML(q, propositions)`,
réutilisée telle quelle par les deux rendus. Pour LCA, `renderCoquilleLCA()` construit UNE SEULE
FOIS la coquille (article + onglets + conteneur `#lca-question-zone`) ; à chaque validation,
`renderQuestionCourante()` ne remplace plus que `#lca-question-zone`/`#lca-position`/
`#lca-progression`, jamais l'iframe de l'article — sinon elle rechargerait à chaque question et
perdrait la position de lecture. Vérifié en direct (Playwright) : le noeud DOM de l'iframe est
strictement identique (`===`) avant et après avoir validé une question.
**Écarté.** `<object>` : `<iframe>` retenu à la place, plus universellement adapté à une URL
externe quelconque (pas seulement un PDF) — un lien "Ouvrir dans un nouvel onglet" reste affiché
en toutes circonstances (secours si l'iframe est bloquée par une politique X-Frame-Options, ce
qu'on ne peut pas détecter côté script).
**Écarté aussi.** Dupliquer deux arbres DOM mobile/desktop (comme le binôme ECOS du lot 5) : un
seul arbre avec `data-onglet-mobile` suffit ici puisqu'il n'y a qu'un seul id `#lca-question-zone`
à cibler, pas de risque de doublon d'id contrairement à la grille ECOS cochable des deux côtés.
Les questions de LCA comptant double dans les statistiques (§5.9/§8) : reporté au lot 7 (page
Stats), pas une préoccupation du joueur lui-même.

### Modale Constantes biologiques : bouton flottant dans la coquille, pas une page
**Contexte.** §8 lot 6 : "accessible depuis tous les écrans externat (bouton flottant et raccourci
clavier libre, vérifié dans le résolveur)".
**Retenu.** `pages/externat/constantes-modal.js` + un bouton flottant posé une seule fois dans
`renderShell` (main.js), visible/masqué par `appliquerNavPourCycle()` selon le cycle courant —
jamais par page, pour rester vraiment disponible "depuis tous les écrans" sans dépendre de quelle
page est montée. Réutilise `.modal-overlay`/`.modal-panel` (classes déjà partagées) : Échap la
ferme gratuitement via le mécanisme générique déjà câblé dans `executerRaccourci`
(`close-modal` cherche n'importe quel `.modal-overlay:not(.hidden)`), aucun code à ajouter.
Cache module (un seul appel réseau par session, les valeurs ne changent jamais en cours de route).
**Raccourci clavier "v"** : `resoudreRaccourci` le résout sur N'IMPORTE QUELLE route, y compris en
P2 (fonction pure, ignore le cycle par conception, même principe que `routeAccueilParDefaut()`
pour "g h") — c'est `executerRaccourci` (main.js) qui vérifie `estExternat()` avant d'ouvrir la
modale, pas le résolveur. Testé : "v" en P2 ne fait rien, "v" en Externat bascule la modale.
**Écarté.** Une page `#constantes` séparée : aurait perdu le contexte de la question/du dossier en
cours à chaque consultation (rupture du flux d'examen), contrairement à une modale superposée.

### Mode examen (§8 lot 6) : joueur dédié `edn-examen.js`, pas une variante de mode dans edn-question/edn-dossier
**Contexte.** §8 : "compte à rebours global configurable, soumission forcée à zéro, aucune
correction avant la fin." Très différent du flux entraînement existant (correction immédiate après
chaque question, chrono par question, tag d'erreur immédiat et bloquant si raté).
**Retenu.** Un nouveau module `pages/externat/edn-examen.js` (`demarrerExamenExterne(cibles,
dureeMinutes, simulateurUness)`, lancé depuis un bouton "Lancer un examen" sur `#edn-banque`),
plutôt que d'ajouter un 3e mode dans `edn-question.js`/`edn-dossier.js` déjà denses. Chaque dossier
sélectionné est **éclaté** en questions individuelles pour l'examen (un seul chrono global sur
l'ensemble, questions et dossiers mélangés librement) — mais les tentatives restent regroupées et
enregistrées **une par origine** (dossier ou question isolée) à la fin, exactement comme en
entraînement, pas une tentative par question de dossier.
**Écarté.** Garder la structure "un dossier = ses questions ensemble" pendant l'examen lui-même :
le chrono global rend cette distinction sans intérêt pendant le jeu (aucune question ne se
distingue visuellement d'une autre), seul le regroupement au moment d'enregistrer compte.
**Tags d'erreur au bilan (§7.4 : "proposé au bilan de fin" en mode examen)** : un seul sélecteur de
tags pour tout l'examen (appliqué à chaque origine ratée) plutôt qu'un sélecteur par origine —
`attacherTagsErreurChips` cible un id fixe `#tags-erreur-chips`, non paramétrable ; multiplier les
instances aurait demandé de le modifier pour un gain marginal (l'examen entier partage déjà un
seul contexte de révision).
**Bug trouvé et corrigé en testant en direct** : le premier jet de l'écran de revue utilisait des
ids uniques par bloc (`zone-reponse-revue-${i}`/`correction-revue-${i}`) pour éviter les doublons
d'id — mais `renderEtVerrouillerCorrection` (question-engine.js) cherche `#correction-zone` **tel
quel**, sans paramètre. Résultat : aucune correction ne s'affichait (retour silencieux de la
fonction, `zone` valant `null`). Corrigé en réutilisant les ids exacts attendus (`#zone-reponse`,
`#correction-zone`) : `querySelector` reste scopé au sous-arbre de CHAQUE bloc de la revue, donc
l'id dupliqué document-wide (HTML invalide mais sans conséquence pratique ici) résout correctement
la bonne zone pour chaque question — confirmé par un test Playwright qui dumpait le HTML réel de
la revue avant de conclure, pas seulement un contrôle de présence de classe CSS.
**Simulateur UNESS** : classe `.simulateur-uness` posée sur le conteneur (`.wrap`) de chaque écran
du joueur d'examen, jamais un thème global. Redéfinit les tokens de couleur (comme `@media print`
le fait déjà pour un besoin similaire) et neutralise les deux classes de correction qui utilisent
une couleur codée en dur plutôt qu'une variable (`.checkbox-label.wrong`, `.edn-prop-wrong`,
toutes deux `#C46A5C`) — couverture volontairement limitée aux éléments de correction réellement
visibles sur cet écran, pas un audit exhaustif de chaque couleur codée en dur du site. `#wallpaper-
layer` et le verre dépoli de la topbar/tabbar sont masqués via `body:has(.simulateur-uness)`,
scopé à la présence réelle de la classe dans le DOM (jamais persisté au-delà de la page montée).
**Raccourcis clavier** : `edn-examen` ajoutée à `ROUTES_QCM` (Entrée retombe directement sur
"suivant-btn", il n'y a pas de "valider-btn" puisqu'aucune correction n'est montrée avant la fin ;
1-5 cochent une proposition), à `ROUTES_SANS_ARROW_LEFT` et à `ROUTES_SANS_N_R` (quitter un examen
en cours par accident coûterait bien plus qu'une seule question).
Vérifié en direct (Playwright, dialogues `prompt`/`confirm` interceptés) : sélection dans la
Banque → lancement → chrono global qui décroît → aucune correction avant la fin → revue avec
correction colorée correcte pour chaque question → tags d'erreur optionnels → tentatives
enregistrées une par origine → soumission forcée confirmée en laissant le chrono expirer sans
interagir. `npm test` (473 tests) et `npm run build` verts.

## Lot 7 — Statistiques et exports

### Page `#edn-stats` séparée de `#stats` (P2), lien "Statistiques" du menu devenu cycle-aware
**Contexte.** §8 : "Page Stats externat" — jusqu'ici `#stats` renvoyait TOUJOURS vers la page de
stats P2 (`renderStats`), même en mode Externat : le lien du menu déroulant n'était pas
conditionné par le cycle (contrairement au reste de la navigation).
**Retenu.** Nouvelle route `#edn-stats` (même principe que `#edn-accueil` vs `#accueil`) : le lien
"Statistiques" du menu pointe vers `#edn-stats`/`#stats` selon `cycle`, ajouté à
`EDN_ROUTE_HANDLERS` et à `SECONDARY_ROUTES`. Bug préexistant corrigé au passage (pas introduit par
ce lot, mais jamais remarqué avant faute de page Externat à comparer).
**Écarté.** Rendre `#stats` lui-même cycle-aware (comme `route === 'accueil'` ne l'est pas non
plus, par choix déjà acté) : casser une route existante utilisée par des liens/favoris potentiels
aurait été un changement plus risqué qu'en ajouter une nouvelle.

### Unités évaluées : aplatir chaque tentative (dossier ou question) en une entrée par question notée
**Contexte.** §8 : "réussite par spécialité, item, format et rang" — mais une tentative de dossier
ne stocke qu'un `detail` (scores par sous-question), sans le format/rang/spécialités/items de
chaque sous-question (ceux-ci vivent sur les lignes `edn_questions` du dossier, jamais dupliqués
dans la tentative).
**Retenu.** La page (`edn-stats.js`) résout, pour chaque dossier RÉELLEMENT tenté (jamais tous les
dossiers), ses questions via `getDossierAvecQuestions`, puis aplatit `detail[i]` + les métadonnées
de la question `i` en une "unité évaluée" — la même forme qu'une tentative de question isolée.
`lib/edn-stats.js` (pur, testé) n'agrège jamais que ce format uniforme, jamais deux chemins de
calcul selon la provenance.
**LCA comptée double** : appliqué non seulement aux regroupements par spécialité/item/format/rang
mais aussi à la note AA estimée (`noteAAEstimee`) — la spec liste "LCA comptée double" comme un
point séparé de "note AA estimée", mais les deux sont des agrégats de réussite ; les traiter
différemment aurait été arbitraire et jamais justifié par le texte. Vérifié par un test dédié
(une unité double-A issue d'un dossier LCA pèse 2x dans le calcul).

### Fatigue score : sessions reconstruites par écart entre tentatives consécutives, pas une colonne
**Contexte.** §8 : "calculé à partir de `date_tentative` et `duree_s` **sans nouvelle donnée**" —
aucun `session_id` n'existe et n'en sera ajouté.
**Retenu.** `reussiteParDureeSession` (lib/edn-stats.js) trie les tentatives par date, démarre une
nouvelle "session" dès que l'écart avec la tentative PRÉCÉDENTE (jamais le début de la session en
cours — bug trouvé et corrigé en écrivant les tests : comparer au début de session aurait empêché
toute session de dépasser le seuil de pause) dépasse `SEUIL_PAUSE_SESSION_MIN` (30 min), puis
regroupe la réussite par tranche de minutes écoulées depuis le début de CETTE session.
**Message factuel** (`messageFatigue`) : un simple constat chiffré ("réussite la plus haute à
Xh (Y%), la plus basse à Zh (W%)"), jamais une recommandation — et seulement si l'écart dépasse
20 points ET que chaque heure comparée a un échantillon d'au moins 3 unités (sinon un pic à 100%
sur une seule question à 3h du matin serait trompeur).
**ECOS inclus dans le calcul de fatigue** (pas seulement EDN) : les deux partagent `date_tentative`
et `score`/`score_max`, la page Externat est un tout, pas deux fatigue scores séparés.

### Exports (CSV Anki, PDF) limités aux questions isolées "à revoir"
**Contexte.** §8 : "CSV compatible avec l'import d'Anki (recto = énoncé, verso = correction +
explication)" et "PDF « mes erreurs » via le jsPDF existant".
**Retenu.** Réutilise EXACTEMENT la même source que le Carnet d'erreurs
(`getTentativesEdnARevoir()` + `resoudreCiblesEnDetail()`, lib/edn-carnet.js — étendu pour inclure
`contenu`/`explication` dans le select, un ajout additif sans risque pour son autre usage) plutôt
que de redéfinir "qu'est-ce qu'une erreur" une seconde fois. `lib/edn-export.js`
(`correctionTexte`, pur, testé par format) est la source UNIQUE de "qu'est-ce que la bonne
réponse" pour le CSV et le PDF, jamais deux logiques de correction qui pourraient diverger.
**Écarté.** Inclure les dossiers en erreur dans ces exports : le Carnet d'erreurs traite un
dossier comme UNE seule cible (pas de sous-score par question conservé au même niveau que pour une
question isolée), et `correctionTexte` opère sur une question, pas un dossier entier. Développer
la ventilation par sous-question d'un dossier en erreur uniquement pour l'export aurait
dépassé le périmètre du lot pour un gain marginal (l'essentiel du carnet reste des questions
isolées) — signalé explicitement dans l'UI de la page Stats plutôt que silencieusement omis.
**Format CSV** : texte brut uniquement (markdown retiré via `texteBrut`), jamais de HTML, pour
rester compatible avec un import Anki basique sans avoir à cocher "Allow HTML in fields".

`npm test` (508 tests, +43 pour ce lot) et `npm run build` verts. Vérifié en direct (Playwright) :
tableau de bord complet avec données réalistes (spécialités, items, ECOS, fatigue), filtre
d'obsolescence qui distingue correctement obsolète/non-obsolète, export CSV et PDF déclenchant
chacun un téléchargement réel avec le bon contenu.

## Lot 8 — Hors-ligne (PWA)

### `vite-plugin-pwa` est compatible Vite 8 — vérifié réellement, pas juste sur la déclaration de peerDependencies
**Contexte.** §8 : "Vérifie d'abord que vite-plugin-pwa est compatible avec Vite 8. Sinon, écris un
service worker minimal à la main et consigne le choix."
**Retenu.** `peerDependencies` de vite-plugin-pwa 1.3.0 couvre déjà `^8.0.0`, et surtout un
`npm run build` réel (pas juste `npm install`) génère correctement `dist/sw.js` +
`dist/workbox-*.js` (37 entrées précachées, ~4,3 Mo) sans aucune erreur — la déclaration seule
n'aurait pas suffi à en être sûr sur une version aussi récente de Vite. Premier `vite.config.js`
du projet (il n'en existait aucun jusqu'ici, Vite tournait sur ses réglages par défaut).
**`manifest: false`** dans la config du plugin : `public/site.webmanifest` existe déjà et reste la
seule source du manifeste (§8 : "plutôt que d'en créer un second") — le plugin se contente
d'injecter l'enregistrement du service worker (`registerSW.js`) dans `index.html`.
**Écarté.** Écrire un service worker à la main : inutile, la compatibilité réelle est confirmée.

### Tentatives hors-ligne : détection à l'avance (`navigator.onLine`) + repli sur erreur réseau, jamais une seule des deux
**Contexte.** §8 : "mises en file dans IndexedDB avec leur id UUID client et leur date_tentative
locale... rejouées au retour du réseau par un insert idempotent."
**Retenu.** `enregistrerTentative`/`enregistrerTentativeEcos` vérifient `navigator.onLine` AVANT de
tenter la requête (évite une tentative de connexion vouée à l'échec, et son délai), mais mettent
aussi en file si la requête échoue malgré `onLine === true` (cas réel : `navigator.onLine` peut
rester vrai sans connectivité effective) — détecté via `err instanceof TypeError`, signature du
`fetch` natif qui n'atteint jamais le serveur, jamais confondu avec une vraie erreur métier/
validation renvoyée PAR le serveur (celle-ci continue de remonter normalement).
**Aucune mise à jour SRS incrémentale pendant la mise en file** : contrairement au chemin en ligne
(qui met à jour le SRS immédiatement après chaque tentative), une tentative mise en file ne touche
JAMAIS `edn_srs` — l'état "avant" n'est pas fiable tant que d'autres tentatives en attente
n'ont pas encore été rejouées. Tout le recalcul SRS se fait au retour du réseau.
**Recalcul SRS par rejeu complet de l'historique, pas incrémental** : `rejouerHistoriqueSrs`
(lib/edn-srs.js, pur, testé) reconstruit l'état final d'une cible en rejouant TOUTES ses
tentatives triées par `date_tentative`, plutôt que d'appliquer seulement les tentatives mises en
file par-dessus l'état déjà en base — robuste si d'autres tentatives (en ligne, sur un autre
appareil) se sont ajoutées à la même cible pendant la coupure.
**File générique** (`lib/offline-queue.js`) : ne connaît qu'"une table, une ligne, éventuellement
des items pour le SRS" — jamais la forme précise d'une tentative EDN ou ECOS. Ce module NE
dépend PAS de `edn-tentatives.js`/`ecos-tentatives.js` (qui construisent leur ligne avant de la
mettre en file) : évite un import circulaire, `edn-tentatives.js` important lui `mettreEnFile`
depuis `offline-queue.js`.
**Indicateur "hors-ligne · N en attente"** : mis à jour via un évènement DOM
(`studik:file-hors-ligne-changee`) émis par `offline-queue.js` à chaque ajout/rejeu, écouté par
main.js — jamais un import direct de main.js dans un module `lib/`, qui inverserait la
dépendance. Bug trouvé en testant en direct : l'indicateur ne se rafraîchissait qu'au changement
de cycle ou aux évènements `online`/`offline`, jamais juste après une mise en file pendant qu'on
restait déjà hors-ligne — corrigé par cet évènement dédié.

### "Préparer le hors-ligne" : télécharge le contenu à afficher, pas un mode de jeu hors-ligne complet
**Contexte.** §8 : "télécharge dans IndexedDB les cibles dues du jour (au plafond) et leurs
images."
**Retenu.** Réutilise `getCiblesDuesTriees`/`getPlafondRevisions` (lib/edn-dashboard.js, déjà
utilisées par le tableau de bord — même définition de "cibles dues" partout) et enregistre le
contenu de chaque cible (question ou dossier+questions) + ses images dans IndexedDB.
**Écarté (portée volontairement limitée).** Faire fonctionner le JOUEUR de questions/dossiers
lui-même hors-ligne (lire depuis IndexedDB si le réseau est coupé) : aurait demandé un repli
hors-ligne dans `edn-question.js`/`edn-dossier.js`/`question-engine.js`, un changement bien plus
large que "préparer le contenu". Le bouton télécharge ce qu'il faut pour consulter (lecture), les
TENTATIVES hors-ligne (écriture) sont déjà couvertes par la file — les deux réunis suffisent à
l'usage principal (réviser dans le métro), sans réécrire toute la couche de données en mode
"offline-first".

`npm test` (512 tests, +4 pour `rejouerHistoriqueSrs`) et `npm run build` verts (SW généré avec
succès). Vérifié en direct (Playwright, `navigator.onLine` forcé plutôt que le vrai mode hors-ligne
du navigateur pour ne pas couper aussi la connexion au serveur de développement) : tentative mise
en file pendant la coupure (aucun insert tenté), indicateur affiché immédiatement, retour en ligne
→ rejeu idempotent + recalcul SRS + file vidée + indicateur qui disparaît, bouton "Préparer le
hors-ligne" sans erreur.

## Fiabilité et interface — branche `reliability-and-ui-fixes` (après la phase 2)

### Pagination Supabase : un helper générique, pas de `.range()` au cas par cas

**Contexte.** Demande explicite de Sullivan, après avoir réalisé que PostgREST plafonne toute
lecture à 1000 lignes sans erreur (silencieusement tronqué au-delà) et qu'aucune requête du
projet — P2 ou Externat — n'utilisait `.range()`. Audit imposé de chaque lecture Supabase,
classée A (lecture complète pouvant dépasser 1000 lignes)/B (bornée volontairement, à ne pas
toucher)/C (agrégat calculé côté client).

**Retenu.** `lib/supabase-paginate.js` (voir CLAUDE.md, section "Lectures Supabase et
pagination", pour le détail et la règle de classification) : `paginerTout` (pages de 1000 via
`.range()`) et `requeteParLots` (`.in()` découpé en lots de 200). Appliqués à toutes les lectures
classées A, aussi bien P2 (fiches, cas, QCM, tentatives, matières/cours, captures, checkins,
contenu_cours) que Externat (dossiers/questions EDN, tentatives EDN, stations/tentatives ECOS,
état SRS). Colonnes de tri existantes complétées par un critère de départage garantissant un
ordre total (le plus souvent `id`) partout où ce n'était pas déjà le cas.

**Écarté : des fonctions/vues Postgres pour les agrégats (catégorie C).** `getStatsTentatives`,
`getAllTentativesQcmStats`, `getToutesLesTentativesEdn`, `getToutesLesTentativesEcos` continuent
de calculer leurs statistiques côté client à partir de l'historique complet, simplement lu en
entier via `paginerTout` comme une lecture A plutôt que via une fonction SQL dédiée. Aucun
mécanisme de fonction/vue Postgres n'existe ailleurs dans ce projet ; en introduire un pour
quelques agrégats aurait ajouté une seconde façon de faire pour un gain qui ne se justifie pas à
l'échelle d'un usage solo. Un seul helper, une seule convention.

**Bug trouvé en corrigeant tous les `.in()` du projet (pas un bug rapporté)** :
`resoudreCiblesEnDetail` (`lib/edn-carnet.js`, carnet d'erreurs Externat) construisait bien
`idsQuestions`/`idsDossiers`, mais ne les passait jamais à un `.in()` — les deux requêtes lisaient
la table entière (`edn_questions`/`edn_dossiers`) à chaque affichage, sans effet visible (la map
finale ne gardait que ce qui était utilisé). Corrigé au passage : `.in('id', lot)` ajouté,
découpé par `requeteParLots`. Voir CLAUDE.md, pièges déjà rencontrés.

`npm test` (528 tests, +15 pour `lib/supabase-paginate.test.js`) et `npm run build` verts. Vérifié
par un test "fumée" temporaire (mock Supabase, 1500 fiches / 1300 checkins, supprimé après
vérification — pas dans l'historique) que `getAllFichesRaw`/`getFiches`/`getCheckins` renvoient
bien tout, pas seulement les 1000 premières lignes.

### Sauvegarde/restauration étendue à l'Externat : un module dédié, pas un second système

**Contexte.** Demande explicite : la sauvegarde de Paramètres ne couvrait que le P2. L'étendre à
l'Externat sans dupliquer le mécanisme existant, avec un préflight (pas de transaction atomique
possible sans fonction Postgres) et un ordre de restauration déduit des vraies clés étrangères.

**Retenu.** `lib/backup.js` (détail dans CLAUDE.md, section "Sauvegarde et restauration") centralise
ce que `parametres.js` faisait jusque-là en ligne dans son gestionnaire de clic — pas un second
système, la même liste de fonctions `insertX`/`restaurerX` déjà utilisées ailleurs, simplement
sortie dans un module testable et étendue à l'Externat. Champ `version` (absent = ancien format
P2, restauré à l'identique via `restaurerLegacy`, une copie figée du code d'avant). Préflight
(`preparerRestauration`) qui vérifie la structure puis la résolvabilité des références réelles
(`edn_questions.dossier_id` → `edn_dossiers`, `ecos_tentatives.station_id` → `ecos_stations`,
`matieres.parent_id` → `matieres`) contre le fichier ET la base, AVANT toute écriture — sinon une
contrainte de clé étrangère aurait échoué en cours de restauration avec une erreur Postgres brute,
après que certaines tables aient déjà été écrites.

**Écarté : une transaction Postgres (fonction RPC) pour une restauration atomique.** Demande
explicite de ne pas l'implémenter (aucune fonction SQL n'existe ailleurs dans ce projet). À la
place : préflight strict en amont (réduit fortement le risque d'échec en cours de route) + message
d'erreur nommant la table en cause + upsert par id partout, donc une restauration interrompue peut
être intégralement relancée depuis le même fichier sans dupliquer ni perdre quoi que ce soit.

**Préférences Externat (cycle, plafond de révisions, tags d'erreur) : lues/écrites via
`lirePreference`/`ecrirePreference` directement, jamais via `getPlafondRevisions()`/
`getTagsErreur()`.** Ces deux fonctions renvoient un défaut applicatif quand la préférence n'a
jamais été écrite (100/jour, liste par défaut) — un défaut ne doit jamais se retrouver sauvegardé
puis réécrit comme s'il s'agissait d'une vraie valeur choisie par Sullivan lors d'une restauration
vers une autre base.

**Images (Storage) non incluses, assumé.** La sauvegarde reste "les lignes de la base", pas les
fichiers — même limite déjà connue côté P2, rendue visible sur la carte Sauvegarde des Paramètres
plutôt que découverte au moment d'une restauration. Aucune refonte du stockage dans cette PR
(explicitement hors périmètre de la demande).

**File hors-ligne (IndexedDB) : avertissement, pas un blocage.** Si des tentatives EDN/ECOS
attendent encore le retour du réseau au moment de l'export, elles ne sont pas dans le fichier
(pas encore en base) — `exporterSauvegarde()` renvoie leur nombre, Paramètres affiche un
avertissement après le téléchargement plutôt que d'empêcher l'export (l'utilisateur peut vouloir
sauvegarder quand même, puis réessayer plus tard une fois reconnecté).

**Bug préexistant trouvé et corrigé (indépendant de l'Externat, découvert en écrivant le test
d'aller-retour export→restauration demandé)** : l'export "tentatives" (cas cliniques) réutilisait
`getStatsTentatives()` (`lib/cas.js`) — pensée pour l'affichage de la page Stats, elle ne
sélectionne que `id, reussi, date_tentative, cas_cliniques(matiere, type, question)`. Aucun
`cas_id`, aucune `reponse_donnee`, aucun `a_revoir`, et le cas joint n'a même pas son `id` — une
restauration produisait donc des tentatives avec `cas_id: undefined` (la ligne existante de
`restaurerTentatives`, `t.cas_id || t.cas_cliniques?.id`, ne pouvait pas non plus s'en sortir
puisque `cas_cliniques.id` n'était pas sélectionné). Corrigé par une fonction dédiée à la
sauvegarde, `getAllTentativesRaw()` (`select('*')`, paginée) ; `getStatsTentatives()` reste
inchangée pour la page Stats.

`npm test` (540 tests, +12 pour `lib/backup.test.js` : aller-retour complet mocké — ids, relation
dossier→questions, relation station→tentatives ECOS, tentatives et SRS restaurés tels quels,
préférences Externat, format historique sans version, préflight structure/références, erreur
nommée et relançable) et `npm run build` verts. Vérifié en direct (Playwright, mock Supabase en
mémoire dans le navigateur) via la vraie page Paramètres : export réel (téléchargement intercepté,
JSON inspecté), restauration de ce même fichier, restauration d'un ancien fichier sans `version`,
refus propre d'un fichier malformé et d'une référence irrésoluble — aucune écriture dans ces deux
derniers cas, aucune erreur console.

### Popup heatmap masquée derrière la section Matières : la cause réelle n'était pas l'hypothèse initiale

**Contexte.** Au survol/tap de `.streak-card` (accueil P2), `.heatmap-popup` (calendrier de streak,
`z-index: 20`) se peignait systématiquement SOUS la section "Matières" qui suit dans le DOM, en
mode verre dépoli. L'hypothèse de départ ciblait `isolation: isolate` sur `.streak-card` (ajouté
au commit be80880), en s'appuyant sur un piège déjà documenté dans CLAUDE.md pour un bug similaire
côté heatmap Externat.

**Retenu.** Vérifié empiriquement (Playwright, en isolant chaque variable une par une) que
`isolation: isolate` n'est PAS la cause : retirer cette seule propriété ne change rien tant que le
mode verre dépoli est actif, et sans mode verre le bug n'existe pas du tout, avec ou sans
isolation. La vraie cause est `[data-glass="on"] .settings-card { backdrop-filter: ... }` — cette
règle s'applique aussi à `.streak-card` (qui est un `.settings-card`), et `backdrop-filter`
recrée exactement le même piège de contexte d'empilement qu'`isolation: isolate`, indépendamment
d'elle. Corrigé en ajoutant un `z-index: 5` explicite sur `.streak-card:hover`/`.streak-card.ouvert`
(bien en dessous des `z-index: 50` de `.modal-overlay`, jamais en conflit avec une modale) : peu
importe ce qui promeut `.streak-card` en contexte d'empilement isolé, un z-index explicite le fait
gagner face à la section suivante, qui reste elle à z-index automatique.

Effet de bord découvert pendant la correction : une fois le popup effectivement peint au-dessus,
son fond `background: var(--surface-2)` — rendu translucide par le mode verre dépoli — laissait
transparaître le texte de la section du dessous, NET et illisible, sans aucun flou. Cause : le
parent direct du popup (`.streak-card`) a déjà son propre `backdrop-filter` en mode verre ; un
second `backdrop-filter` imbriqué sur le popup lui-même ne parvient pas, dans Chromium, à flouter
ce qui est peint par un élément extérieur à ce parent (une autre section du DOM) — seule la
translucidité du fond s'applique, sans le flou attendu. Corrigé en gardant `.heatmap-popup` HORS
de la liste `[data-glass="on"] .settings-card, ...` et en lui donnant un fond toujours opaque
(`rgb(var(--surface-rgb))` plutôt que `var(--surface-2)`), qui ne varie pas avec le mode verre.

**Écarté.** Ajouter `.heatmap-popup` à la liste des sélecteurs `[data-glass="on"]` qui reçoivent
`backdrop-filter` — testé, ne résout pas la lisibilité (voir effet de bord ci-dessus) et aurait
rendu ce petit popup utilitaire aussi translucide qu'une grande carte, sans bénéfice.

Vérifié en direct (Playwright, mock Supabase en mémoire) à 375px et 1280px, avec et sans fond
d'écran/mode verre dépoli, au survol (desktop) comme via `.ouvert` (tap tactile), avec un jeu de
données volontairement chargé (8 matières) pour garantir un chevauchement géométrique réel entre
le popup et la section Matières dans tous les cas. `npm test` et `npm run build` verts.
