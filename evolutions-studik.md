# Évolutions Studik — à traiter dans cet ordre (dépendances)

## 1. Système de tags universel (base des points 4 et 6)

Actuellement `tags_reference` existe déjà (liste fermée gérée sur `#prompts`), mais seules les **fiches** ont un champ `tags`. Il faut l'étendre.

**Migration SQL :**
```sql
alter table cas_cliniques add column tags text[] default '{}';
alter table qcm add column tags text[] default '{}';
```
(les grants existants sur ces deux tables couvrent déjà `update`, pas de grant supplémentaire nécessaire)

**Composant réutilisable** : créer un petit composant "tag-picker" (fonction JS réutilisée dans plusieurs pages, pas un fichier séparé obligatoire mais éviter la duplication) qui :
- affiche les tags déjà choisis en chips supprimables (comme `.tags`/`.tag` déjà stylé)
- propose un `<select>` ou une saisie avec autocomplétion parmi les tags de `tags_reference` (réutiliser `getTags()` de `lib/tags.js`)
- ne permet PAS de taper un tag libre non présent dans `tags_reference` — rediriger vers `#prompts` pour en créer un nouveau si besoin (garder la liste fermée, c'est le principe déjà établi)

**Où l'appliquer :**
- `fiche-detail.js`, panneau "Gestion" : remplacer le `<input>` texte libre actuel par ce tag-picker
- `cas-liste.js` : ajouter l'édition des tags par cas (actuellement seul le statut est éditable en ligne)
- `qcm-liste.js` : idem, ajouter l'édition des tags par QCM

**Import** (`import.js`) : ajouter le même avertissement non bloquant déjà en place pour les matières inconnues, mais pour les tags inconnus — sur les 3 types fiches/cas/qcm, si un tag présent dans le JSON n'existe pas dans `tags_reference`.

## 2. Filtre multi-tags dans Entraînement

Dans `entrainement.js`, ajouter un sélecteur multi-tags (à côté des filtres matière/niveau existants) qui filtre les cas proposés par `getCasAleatoire`. Il faut étendre `getCasAleatoire({ matiere, niveau, tags })` dans `lib/cas.js` pour accepter un tableau de tags et ne renvoyer que les cas qui en contiennent au moins un (ou tous, à décider — au moins un est plus permissif et probablement plus utile en pratique).

Optionnel, pas demandé explicitement mais cohérent : le même filtre pourrait être ajouté au Référentiel et à la Bibliothèque de QCM plus tard, une fois que ce filtre existe et fait ses preuves sur l'entraînement.

## 3. Édition du contenu détaillé d'une fiche

Sur `fiche-detail.js`, ajouter un nouvel onglet "Contenu" dans la sidebar (entre "Liens" et "Notes perso"), permettant d'éditer :
- `synonymes` (input simple, séparé par virgules, comme les tags le sont actuellement)
- chaque champ de `contenu_structure`, adapté à sa forme :
  - si c'est un texte libre (ex. `description`, `localisation`, `fonction`) → `<textarea>` normal, la mise en forme `**gras**`/`==surligné==`/`!!important!!` reste supportée telle quelle
  - si c'est une liste (ex. `contexte_recherche`, `etapes`, `facteurs_declenchants`, `rapports_anatomiques`) → `<textarea>` où **une ligne = un élément de la liste**, à splitter sur `\n` et filtrer les lignes vides à la sauvegarde
- `pathologies_associees` (fiches cliniques uniquement) → même principe une-ligne-un-élément

Un bouton "Enregistrer le contenu" fait un `updateFiche(id, { synonymes, contenu_structure, pathologies_associees })` — ajouter cette fonction générique dans `lib/fiches.js` si elle n'existe pas déjà sous cette forme exacte (il y a déjà `updateFicheTags`, `updateStatut`, `updateFicheLiens` sur le même principe, à imiter).

## 4. Création d'une matière depuis le site

Sur `matieres.js`, ajouter en haut de la page un petit formulaire "Nouvelle matière" (nom, type, couleur, ordre d'affichage, année, semestre) qui appelle `insertMatieres([{...}])` avec un id généré automatiquement à partir du nom (même logique que le prompt : minuscules, sans accents, tirets). Il n'y a pas besoin de passer par l'import JSON pour ce cas d'usage ponctuel.

## 5. Création des métadonnées d'un QCM depuis le site

**Important : les questions elles-mêmes restent exclusivement en JSON, seule la fiche d'identité du QCM devient interactive.**

Sur `qcm-liste.js`, ajouter un formulaire "Nouveau QCM" (titre, matières — plusieurs possibles, durée en minutes, tags) qui crée une ligne dans `qcm` avec `questions: []` et un id généré à partir du titre.

Ensuite, pour ajouter les questions : le prompt `prompt-qcm.md` génère un JSON complet (id + toutes les métadonnées + questions) OU, si le QCM existe déjà, on peut coller un JSON minimal `{ "id": "qcm_existant", "questions": [...] }` via `#import` (cible QCM) — l'`upsert` déjà en place ne touche que les champs présents dans l'objet, donc ça complète les questions sans écraser le reste. Vérifier que `insertQcm`/l'import gèrent bien ce cas (upsert partiel), sinon l'ajuster.

## Notes générales

- Respecter l'identité visuelle et les composants déjà en place (`.settings-card`, `.periode-select`, `.tag`/`.tags`, `.btn`/`.btn.primary`) — ne pas réinventer de nouveaux styles pour ces formulaires.
- Chaque nouvelle table/colonne modifiée doit recevoir les grants Postgres explicites (voir `CLAUDE.md`, section pièges connus).
- Confirmation avant toute action destructive, cohérent avec le reste du site (déjà en place partout ailleurs).
