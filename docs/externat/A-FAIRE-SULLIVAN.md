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
6. **Compléter le 11e domaine de compétence ECOS** (guide CNG) dans la constante dédiée du code
   (§5.9 de la spec) — seuls 10 des 11 domaines connus ont été codés en dur, le 11e t'appartient
   (Claude n'invente pas de contenu médical/officiel).
7. **Relire `docs/externat/DECISIONS.md`** avant de donner ton feedback pour la phase 2 : chaque
   arbitrage pris sans te demander y est journalisé avec le contexte et l'alternative écartée.

## Une fois la phase 1 relue et mergée

8. Donne tes retours à Claude pour lancer la phase 2 (§10 "Prompts de lancement" de la spec, prompt
   "Phase 2").
