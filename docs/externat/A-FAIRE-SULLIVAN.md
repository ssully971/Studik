# À faire toi-même — Mode Externat V2

Liste ordonnée de ce que Claude ne peut pas faire à ta place (pas d'accès à ta base Supabase
réelle). Coche au fur et à mesure.

## Après la phase 1 (lots 1 à 4)

1. **Appliquer la migration** `supabase/migrations/001_externat_fondations.sql` dans l'éditeur SQL
   du tableau de bord Supabase (onglet "SQL Editor" → coller le fichier entier → Run). Elle est
   idempotente : tu peux la rejouer sans risque si tu n'es pas sûr qu'elle soit déjà passée.
2. **Vérifier la RLS** des nouvelles tables avec `node scripts/audit-rls.mjs` (mis à jour au lot 4
   pour inclure les tables externat) — toutes doivent refuser l'accès anonyme.
3. **Tester la bascule de cycle** : Paramètres → carte "Cycle d'études" → passer en Externat,
   vérifier que l'accueil, la navigation (desktop + mobile + menu) et le badge topbar changent, et
   que revenir en P2 restaure exactement le comportement d'avant cette phase.
4. **Tester la dégradation propre** *avant* d'appliquer la migration (si tu veux vérifier ce
   point précisément) : les pages `#edn-*`/`#ecos-*` doivent afficher le message "Migration 001
   non appliquée..." plutôt que planter.
5. **Importer les référentiels officiels** une fois le lot 2 en place :
   - Liste officielle des 367 items R2C (numéro, intitulé, spécialités) → prompt
     `prompt-r2c-items.md` (page Prompts, mode Externat) → coller le JSON obtenu dans `#import`,
     cible "Items R2C".
   - Liste officielle des 356 situations de départ → `prompt-r2c-sdd.md` → même principe, cible
     "SDD".
   - Marque toi-même les items "prioritaires" (must-know) sur `#edn-items` une fois importés —
     ce flag est personnel, aucune IA ne le déduit.
6. **Tester le moteur de questions** (lot 3), une fois un dossier/questions importés (via un JSON
   de test ou en attendant les prompts du lot 4) :
   - Joueur de question isolée `#edn-question/:id` pour chacun des 7 formats.
   - Joueur de dossier `#edn-dossier/:id` (DP/KFP/TCS) : vérifie qu'aucun bouton "précédent"
     n'apparaît jamais et qu'une question validée reste bien verrouillée (no-back, §5.10). Les
     dossiers de type LCA affichent volontairement un message d'attente (lot 6).
   - Éditeur de zones `#edn-zap/:id` sur un vrai téléphone/tablette (tactile) : pose un point,
     ajuste son rayon, supprime-le, enregistre, puis vérifie que le cercle reste bien un cercle
     (pas une ellipse) même sur une image très large/étroite.
7. **Importer un dossier et des questions de test** une fois le lot 4 en place, via les prompts
   `prompt-edn-qi.md`/`prompt-edn-dp.md`/`prompt-edn-kfp.md`/`prompt-edn-tcs.md`/
   `prompt-edn-lca.md`/`prompt-edn-zap.md` (colle `prompt-contexte-maitre-externat.md` avant
   chacun), puis :
   - Vérifie que le tableau de bord (`#edn-accueil`) affiche bien "Révisions dues" une fois une
     première tentative faite, et que "Série Flash" fonctionne (dues en priorité, sinon 5 questions
     déjà tentées au hasard).
   - Vérifie la Banque (`#edn-banque`) : filtre par statut/à corriger/suspendues, bascule
     suspendre/réactiver le SRS d'une cible, changement de statut.
   - Vérifie la section Externat du carnet d'erreurs (`#erreurs`) : filtre par tag/format, bouton
     "Refaire ces erreurs".
   - Vérifie Paramètres → carte "Externat — révision" (plafond, tags d'erreur).
8. **Relire `docs/externat/DECISIONS.md`** avant de donner ton feedback pour la phase 2 : chaque
   arbitrage pris sans te demander y est journalisé avec le contexte et l'alternative écartée
   (dont le 11e domaine de compétence ECOS, l'ajout de la forme "rect" en ZAP, et un lanceur de
   série multi-critères sur l'accueil — à trancher en phase 2 si tu les juges utiles).

## Une fois la phase 1 relue et mergée

9. Donne tes retours à Claude pour lancer la phase 2 (§10 "Prompts de lancement" de la spec, prompt
   "Phase 2"). **Fait** : PR #1 fusionnée, retours donnés le 28/09, phase 2 lancée sur
   `externat-v2-phase2`.

## Phase 2 (lots 5 à 8)

10. **Compléter le 11e domaine de compétence ECOS** : `DOMAINES_ECOS` dans `src/lib/ecos.js` n'en
    liste que 10 (les seuls confirmés dans le guide CNG 2026 à ma connaissance) — ajoute le 11e
    directement dans ce tableau quand tu l'auras trouvé (aucune contrainte en base, un domaine
    hors liste ne bloque rien à l'import, cette liste ne sert qu'au filtre de `#ecos-stations`).
11. **Importer des stations ECOS de test** via `prompt-ecos-station.md` (colle
    `prompt-contexte-maitre-externat.md` avant), cible "Stations ECOS" dans `#import`, puis :
    - Joue une station en mode solo (`#ecos-station/:id`) : vérifie le repère à 7:00 restantes, le
      bip/l'alerte à 1:00, que le chrono reste juste si tu changes d'onglet puis reviens.
    - Teste l'enregistrement audio optionnel (demande la permission micro du navigateur) : vérifie
      qu'il est bien réécoutable/téléchargeable et qu'aucune donnée audio n'apparaît dans la table
      `ecos_tentatives` de Supabase (l'audio ne doit jamais quitter le navigateur).
    - Teste le mode binôme (bascule Candidat/Examinateur) sur mobile et en écran partagé desktop.
    - Teste le mode circuit (plusieurs stations, transition 2:00 entre chacune).
12. **Tester le hors-ligne (§8 lot 8)**, uniquement possible sur le vrai déploiement (pas dans
    cette session, aucun accès à ta base ni à un vrai navigateur avec IndexedDB persistant) :
    - Ouvre l'app, clique "Préparer le hors-ligne" (tableau de bord Externat), vérifie qu'un
      message donne le nombre de cibles préparées.
    - Coupe le Wi-Fi/les données, réponds à une question ou un dossier : l'indicateur "Hors ligne ·
      N en attente" doit apparaître en haut à droite, sans message d'erreur.
    - Réactive la connexion : l'indicateur doit disparaître après quelques secondes (rejeu
      automatique) — vérifie dans Supabase que la/les tentative(s) sont bien arrivées dans
      `edn_tentatives`/`ecos_tentatives`, et que `edn_srs` reflète bien le score.
    - Installe l'app en PWA (icône "Ajouter à l'écran d'accueil" sur mobile, ou l'icône
      d'installation dans la barre d'adresse sur desktop) et vérifie qu'elle s'ouvre sans barre de
      navigateur, avec l'icône Studik.
