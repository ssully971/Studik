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

_(à compléter)_

## Lot 3 — Moteur

_(à compléter)_

## Lot 4 — Rétention

_(à compléter)_
