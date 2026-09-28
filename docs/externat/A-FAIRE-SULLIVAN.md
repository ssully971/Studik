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
   "Phase 2").
