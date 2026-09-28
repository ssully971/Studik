# Studik V2 : mode Externat (EDN + ECOS)

> Cahier des charges destiné à Claude Code. Il remplace le document « Cahier des charges Technique Exhaustif - Studik V2 » rédigé avec Gemini.
>
> Ce document prime sur le document Gemini partout où ils divergent. En particulier, **Studik n'est pas en React** : tout ce que le document Gemini formule en React (`react-markdown`, `@react-pdf/renderer`, « state React »...) doit être traduit dans l'architecture existante.

---

## 0. À lire avant toute ligne de code

1. Lis `CLAUDE.md` en entier. Il décrit la stack (Vite **vanilla JS**, pages en template literals, routeur par hash maison), l'identité visuelle, le modèle de données et surtout la section « Pièges déjà rencontrés ». Chaque piège listé doit être respecté dans le nouveau code.
2. Lis `evolutions-studik.md`, `src/main.js`, `src/lib/scoring.js`, `src/lib/import-schemas.js`, `src/pages/import.js`, `src/pages/qcm-jouer.js`, `src/pages/carnet-erreurs.js`, `src/pages/parametres.js`, `src/lib/preferences.js`, `src/lib/images.js` et `src/data/prompts/`.
3. **Décision qui change par rapport à `CLAUDE.md`.** La répétition espacée, jusqu'ici écartée, est désormais voulue, **uniquement en mode Externat**. Le mode P2 garde exactement son fonctionnement actuel. Tu mettras à jour `CLAUDE.md` en conséquence en fin de phase.

---

## 1. Principes non négociables

- **Zéro régression sur le mode P2.**
  - Aucune table existante ne change de sens.
  - Le barème P2 (`scoring.js` : 1 / 0,5 / 0, barème Outremed) **ne bouge pas**. Le barème EDN (§5) est un module séparé.
  - Le mode par défaut reste le mode P2.
- **Pas de framework.** Pas de React, Vue, routeur externe ni lib UI. Même patron que l'existant :
  - une fonction `render*(container, ...params)` par page dans `src/pages/` ;
  - la logique de données dans `src/lib/` ;
  - un seul `main.css`.
- **Nouvelle dépendance seulement si elle est justifiée**, et chargée en `await import()` quand elle n'est pas nécessaire au démarrage. C'est le même principe que zod aujourd'hui. Tu consignes la justification dans `docs/externat/DECISIONS.md`.
- **Contenu jamais saisi à la main.** Le workflow reste : prompt → JSON → `#import`.
  - **Seule exception autorisée :** l'éditeur de zones ZAP (§5.6). Des coordonnées de clic ne peuvent pas venir d'un JSON généré par une IA.
- **Réutilise les composants existants** : `.fiche-row`, `.settings-card`, `.btn`, `.periode-select`, `.modal-overlay`, `.tag`, le tag-picker, `escapeHtml`, `televerserImage`, jsPDF, `upsertPartiel`, `confirmer`. N'invente pas de nouveau style quand un composant existe.
- **Mobile first.** Chaque écran doit être vérifié à 375 px de large. Studik sera utilisé en stage, sur téléphone.
- **Tu ne génères aucun contenu médical** (questions, items, valeurs biologiques...). Tu construis le moteur, les imports et les prompts de génération. Les jeux de données de test restent dans les fichiers de test, clairement fictifs.

---

## 2. Contraintes d'environnement (important)

- Tu travailles dans le cloud **sans accès à la base Supabase de Sullivan**. Tu ne peux pas exécuter de migration ni tester contre la vraie base. Conséquences :
  - Toute modification de schéma va dans `supabase/migrations/NNN_description.sql`. Les migrations sont numérotées, **idempotentes** (`create table if not exists`, `add column if not exists`...) et contiennent **RLS + policy + `grant select, insert, update, delete ... to authenticated`** explicites pour chaque table (voir `CLAUDE.md`, le grant n'est plus automatique).
  - Tu tiens à jour `docs/externat/A-FAIRE-SULLIVAN.md` : la liste ordonnée de ce que Sullivan doit faire lui-même (migrations à coller dans l'éditeur SQL, données officielles à importer, points à tester à la main).
  - **Dégradation propre.** Si une table externat n'existe pas encore (erreur Postgres `42P01` ou équivalent PostgREST), l'écran concerné affiche un message clair (« Migration 00X non appliquée, voir docs/externat/A-FAIRE-SULLIVAN.md ») au lieu de planter. Le mode P2 ne doit jamais dépendre des tables externat.
- **Git.**
  - Tu travailles sur la branche `externat-v2`, **jamais directement sur `main`** : `main` redéploie automatiquement sur Vercel.
  - Un commit par lot minimum.
  - Avant chaque commit, `npm test` et `npm run build` doivent passer.
  - En fin de phase, tu ouvres une PR vers `main` avec un résumé et un renvoi vers `A-FAIRE-SULLIVAN.md`.
- **Autonomie.** Face à une ambiguïté, ne t'arrête pas pour demander. Choisis l'option la plus simple compatible avec ce document, consigne-la dans `docs/externat/DECISIONS.md` (contexte, option retenue, alternative écartée), puis continue.

---

## 3. Le switch de cycle (P2 ↔ Externat)

- **Stockage.** Préférence `cycle` dans la table `preferences` existante (`lirePreference`/`ecrirePreference`), valeurs `'preclinique' | 'externat'`, défaut `'preclinique'`.
  - La préférence est synchronisée entre appareils, contrairement au thème : c'est un choix de période de vie, pas d'appareil.
  - Un cache `localStorage` évite un flash au démarrage.
- **Où le changer.** Une `.settings-card` « Cycle d'études » dans `#parametres`, avec deux options et un `confirmer()` avant de basculer.
- **Indicateur.** Un petit badge discret dans la topbar (IBM Plex Mono, « P2 » / « EXTERNAT ») rappelle le mode courant. Un clic ouvre directement la carte dans Paramètres. Pas de bascule au clic direct : ça évite les changements accidentels.
- **Effet de la bascule.**
  - L'accueil devient le tableau de bord externat (§7).
  - La navigation principale (menu, tabbar mobile, séquences `g+lettre`) affiche les entrées externat. Les pages P2 restent **accessibles** : le Référentiel de fiches reste utile en externat.
  - Les filtres passent de Semestre/UE (`periode.js`) à Spécialité / Item / SDD.
  - La page Prompts affiche la banque de prompts du mode courant.
  - L'identité visuelle ne change pas. Au plus, une nuance d'accent pour le badge.
- **Implémentation.** Un module `src/lib/cycle.js` (lecture, écriture, abonnement), consulté par `main.js` au rendu de la navigation. Les routes externat sont préfixées `#edn-...` et `#ecos-...`. Si on navigue vers une route externat en mode P2, on affiche un lien pour basculer, pas une erreur.

---

## 4. Modèle de données externat

Toutes les tables sont nouvelles et préfixées. **Aucune table P2 n'est modifiée.** Les ids sont en texte slugifié, comme l'existant (`slug.js`), sauf les tentatives.

### 4.1 Référentiels R2C

- **`r2c_items`**
  - `numero int pk`, `intitule text`, `specialites text[]`
  - `prioritaire boolean default false` : flag personnel « must-know », géré par Sullivan dans l'interface
  - `notes text`
  - ⚠️ **Le rang A/B n'est PAS une propriété de l'item.** Dans la R2C, un item contient des connaissances de rang A et de rang B. Le rang est porté par chaque question (§4.2). Le document Gemini se trompe sur ce point.
- **`r2c_sdd`**
  - `numero int pk`, `intitule text`, `famille text null`
  - Il y a 356 situations de départ.
- **Remplissage.** Rien n'est codé en dur ni reconstitué de mémoire. Sullivan importe les listes officielles via deux nouvelles cibles de `#import` (§6), à partir d'un prompt dédié qui transforme la liste officielle qu'il fournit.

### 4.2 Questions et dossiers

- **`edn_dossiers`**
  - `id text pk`
  - `type text check in ('DP','KFP','TCS','LCA')`
  - `titre text`
  - `sdd int[]`, `items int[]`, `specialites text[]`
  - `vignette text` : contexte initial, texte riche
  - `article_url text null` : LCA uniquement ; URL externe de préférence au Storage, voir §9
  - `source text check in ('annale','entrainement','genere')`
  - `date_reference date null`
  - `tags text[]`
  - `statut text` : mêmes valeurs que l'existant
  - `date_creation timestamptz default now()`
- **`edn_questions`**
  - `id text pk`
  - `dossier_id text null references edn_dossiers on delete cascade`, `ordre int null` : question isolée si `dossier_id` est null
  - `format text check in ('QRU','QRM','QRP','QRP_LONG','QROC','ZAP','TCS')`
  - `rang text check in ('A','B')` : rang de la **connaissance** évaluée
  - `items int[]`, `sdd int[]`, `specialites text[]`
  - `enonce text` : texte riche ; pour un DP, c'est l'information nouvelle dévoilée à cette étape
  - `image text null` : chemin Storage, même pipeline que `q.image` actuel
  - `contenu jsonb` : forme propre au format, voir §5
  - `explication text`
  - `source`, `date_reference`, `tags`, `statut`, `date_creation` : comme pour `edn_dossiers`
- **Rang docimologique** (constante dans `lib/edn-format.js`, pas de colonne) :
  - formats de rang A : `QRU`, `QRP` (courte), `QROC`, `ZAP` ;
  - formats de rang B : `QRM`, `QRP_LONG`, `TCS`.
  - Seules les questions « double A » (connaissance A + format A) comptent pour le seuil de validation de 14/20. Le tableau de bord doit pouvoir calculer une **note AA estimée**.

### 4.3 Tentatives et répétition espacée

- **`edn_tentatives`** (append-only : on n'en modifie jamais une, seuls les tags d'erreur peuvent être ajoutés)
  - `id uuid pk` : **généré côté client** (`crypto.randomUUID()`), indispensable pour l'idempotence hors-ligne (§8, lot 8)
  - `cible text` : `'q:<id>'` pour une question isolée, `'d:<id>'` pour un dossier entier
  - `mode text check in ('entrainement','examen','flash')`
  - `reponses jsonb` : **par id de proposition, jamais par index**, puisque les propositions sont mélangées
  - `score numeric`, `score_max numeric`
  - `detail jsonb` : score par question pour un dossier
  - `duree_s int`
  - `tags_erreur text[] default '{}'`
  - `date_tentative timestamptz` : heure **locale réelle** de la réponse, pas l'heure de synchronisation
- **`edn_srs`**
  - `cible text pk`
  - `etape int`, `prochaine_revision date`, `reussites_parfaites_consecutives int`, `derniere_revision timestamptz`
  - `suspendue boolean default false`
- **Unité de révision.** Une question isolée, ou un **dossier entier** (DP, KFP, TCS, LCA). On ne révise pas une question de DP hors de son dossier : la règle du « no-back » n'aurait plus de sens.

### 4.4 ECOS et constantes

- **`ecos_stations`**
  - `id text pk`, `titre`, `sdd int[]`
  - `domaine text` : liste fermée des domaines de compétence du guide CNG ; en coder 10 connus, voir §5.9, et laisser Sullivan compléter la liste dans une constante
  - `interlocuteur text check in ('PS','PSS','aucun')`
  - `vignette text` : ce que lit le candidat
  - `consignes_examinateur text`, `script_interlocuteur text`
  - `documents jsonb` : images ou résultats remis pendant la station
  - `grille jsonb` : voir §5.9
  - `source`, `tags`, `statut`, `date_creation`
- **`ecos_tentatives`**
  - `id uuid pk`, `station_id`
  - `mode text check in ('solo','binome')`
  - `cochees jsonb`, `score numeric`, `score_max numeric`
  - `global int null` : impression globale de 1 à 5
  - `duree_s int`, `notes text`, `date_tentative timestamptz`
  - Pas d'audio en base, voir §5.9.
- **`constantes_bio`**
  - `id text pk`, `categorie`, `parametre`, `valeur_normale text`, `unite text`, `ordre int`
  - Rempli via import depuis un prompt, jamais de mémoire.

Tu crées tout le schéma dès le lot 1, même pour les fonctionnalités des lots suivants, afin de ne jamais refondre le schéma en cours de route. Tu ajoutes les index utiles : `edn_questions(dossier_id, ordre)`, `edn_srs(prochaine_revision)`, `edn_tentatives(cible, date_tentative)`, et un GIN sur `items`/`sdd`/`tags`.

---

## 5. Moteur docimologique

Cette section repose sur la source officielle suivante : *Règles générales de notation, Conseil scientifique en médecine, 31 janvier 2023* (document « R2C – Docimologie et correction »). Là où le document Gemini diverge, **c'est cette section qui fait foi**.

Toute la notation vit dans **`src/lib/edn-scoring.js`**, en fonctions pures sans accès réseau. Elle est couverte par `src/lib/edn-scoring.test.js`, qui doit **reproduire chacun des exemples chiffrés ci-dessous comme cas de test**.

### 5.1 Modèle commun des propositions

Pour QRU, QRM, QRP et QRP_LONG :

```json
"contenu": {
  "propositions": [
    { "id": "a", "texte": "…", "statut": "indispensable", "explication": "…" },
    { "id": "b", "texte": "…", "statut": "vrai" },
    { "id": "c", "texte": "…", "statut": "faux" },
    { "id": "d", "texte": "…", "statut": "inacceptable" }
  ],
  "n": 3
}
```

- `statut` prend l'une de ces valeurs : `vrai` | `faux` | `indispensable` | `inacceptable`.
  - `indispensable` compte comme vrai. S'il n'est **pas coché**, la question vaut 0.
  - `inacceptable` compte comme faux. S'il est **coché**, la question vaut 0.
- `n` n'existe que pour QRP et QRP_LONG : c'est le nombre de réponses attendues, affiché dans l'énoncé.
- **Mélange** : l'ordre est tiré au hasard à chaque affichage (Fisher-Yates). Les réponses sont stockées par `id`.
- Le « zéro par omission / propositions incompatibles » du document Gemini **n'est pas une règle officielle**. Le mécanisme officiel équivalent, ce sont les propositions indispensables et inacceptables. N'implémente pas `incompatible_with`.

### 5.2 QRU

- 4 à 5 propositions, une seule bonne réponse.
- Notation binaire : 1 si l'unique bonne réponse est cochée et rien d'autre, sinon 0.
- Interface : boutons radio.

### 5.3 QRM (barème par discordance)

- 4 à 5 propositions.
- Une **discordance** est une proposition dont l'état coché ne correspond pas à sa vérité.
- Barème : **0 discordance → 1 ; 1 → 0,5 ; 2 → 0,2 ; 3 ou plus → 0**.
- Les règles indispensable/inacceptable priment et donnent 0.
- Tests obligatoires, avec l'exemple officiel 1 (1 = e indispensable, 2 = z inacceptable, 3 = y vrai, 4 = l faux) :

| Réponses cochées | Score attendu |
| :--- | :--- |
| {1,3} | 1 |
| {1} | 0,5 |
| {3} | 0 |
| {1,2,3} | 0 |
| {1,3,4} | 0,5 |

- Et avec l'exemple officiel 2 (même question, mais 2 = faux au lieu d'inacceptable) :

| Réponses cochées | Score attendu |
| :--- | :--- |
| {1,2,3} | 0,5 |
| {1,2,4} | 0 |
| {1,2,3,4} | 0,2 |

- Attention : **ce barème diffère du barème P2 actuel** (1 / 0,5 / 0). Ne touche pas à `scoring.js`.

### 5.4 QRP (nombre de réponses précisé)

- 4 à 5 propositions. Le candidat ne peut pas cocher plus de `n` propositions : les autres cases se désactivent dès que `n` sont cochées, et se réactivent si on décoche.
- Score = x / n, où x est le nombre de propositions vraies ou indispensables cochées.
- Les règles indispensable/inacceptable priment.
- Test obligatoire, avec l'exemple officiel (n = 3 ; 1 = indispensable, 2 = inacceptable, 3 = vrai, 4 = faux, 5 = vrai) :

| Réponses cochées | Score attendu |
| :--- | :--- |
| {1,3,5} | 1 |
| {1,3,4} | 0,67 (2/3) |
| {1,2,3} | 0 |
| {3,4,5} | 0 |

- Le document officiel écrit « 1 pt (2/2) » pour {1,3,5}, ce qui semble être une coquille puisque le résultat est 3/3 = 1. Note-le dans `DECISIONS.md`.

### 5.5 QRP_LONG

- 10 à 25 propositions, dont 1 à 5 attendues (`n`).
- Limite de `n` cochées, comme en QRP.
- Score = x / n. Pas de statut indispensable ni inacceptable : l'import refuse ces statuts pour ce format.
- Interface : liste filtrable avec un champ de recherche, puisque l'officiel présente ce format en menu déroulant. Elle doit rester utilisable au doigt sur mobile.

### 5.6 ZAP (zones à pointer)

- Structure du contenu :
  ```json
  "contenu": {
    "zones": [ { "id": "z1", "forme": "cercle", "cx": 45.2, "cy": 30.1, "r": 5 } ],
    "x": 1
  }
  ```
  - `x` est le nombre de points que le candidat peut poser, au maximum 5.
- Coordonnées **en pourcentage de l'image** : `cx` en % de la largeur, `cy` en % de la hauteur, `r` en % de la largeur. Le rayon se convertit en tenant compte du ratio de l'image, pour que le cercle reste un cercle à toute taille d'affichage. Jamais en pixels.
- Formes : `cercle` obligatoire. `rect` (x, y, w, h en %) optionnel si c'est simple à ajouter.
- Score = nombre de zones correctes touchées / x. Un clic compte pour une seule zone, et deux clics dans la même zone comptent une fois.
- **Éditeur de zones** : page `#edn-zap/:id`, la seule exception au « pas de saisie de contenu dans l'UI ».
  - La question arrive par import avec son énoncé, son image uploadée ensuite via `televerserImage`, et `zones: []`.
  - Sullivan clique sur l'image pour poser une zone, ajuste le rayon avec un curseur, supprime une zone, puis enregistre.
  - Elle doit fonctionner au doigt, avec les événements pointer.
- Le document Gemini propose la « distance euclidienne ≤ rayon » : c'est correct pour la forme cercle.

### 5.7 QROC

- Réponse libre de 1 à 5 mots, avec un compteur de mots.
- Structure du contenu :
  ```json
  "contenu": { "exactes": ["…"], "acceptables": ["…"] }
  ```
- Score : exacte → 1 ; acceptable → 0,5 ; sinon 0.
- Comparaison après normalisation : minuscules, accents retirés, ponctuation et espaces multiples retirés, articles initiaux retirés.
- Comme la correction automatique d'un texte libre est imparfaite, après correction un bouton discret « Ma réponse était juste / acceptable » permet à Sullivan de rectifier le score de cette tentative avant l'enregistrement. Consigne ce choix.

### 5.8 TCS (test de concordance de script)

- Un TCS est un **dossier de type `TCS`** : une vignette courte issue d'une SDD, puis des questions de format `TCS`.
  - L'officiel en compte 3 : ne rends pas ce nombre obligatoire.
- Chaque question TCS affiche « Si vous pensiez à… », puis « et que vous trouvez… », puis « cette hypothèse devient… ». Échelle -2, -1, 0, +1, +2, avec des libellés lisibles.
- Structure du contenu :
  ```json
  "contenu": {
    "hypothese": "…",
    "information": "…",
    "votes": { "-2": 0, "-1": 9, "0": 7, "1": 3, "2": 0 },
    "panel": "simule"
  }
  ```
- Score : la **réponse modale** (celle qui a le plus de votes) vaut 1. Toute autre réponse vaut votes(réponse) / votes(modale).
  - En cas d'égalité pour le mode, chacune des réponses à égalité vaut 1.
- Tests obligatoires, avec les exemples officiels :
  - TCS #1 = votes {-2:0, -1:9, 0:7, +1:3, +2:0} : -1 → 1 ; 0 → 7/9 ; +1 → 3/9 ; -2 → 0.
  - TCS #2 = votes {-2:0, -1:1, 0:15, +1:4, +2:0} : 0 → 1 ; -1 → 1/15 ; +1 → 4/15.
- `panel` vaut `"simule"` pour du contenu généré, qui n'a pas de vrai panel d'experts, et `"reel"` pour une annale. L'interface affiche un petit badge « panel simulé ».

### 5.9 ECOS

Les règles viennent du guide du candidat CNG 2026 et de l'arrêté d'ouverture des ECOS 2026.

- **Épreuve officielle.**
  - 10 stations en 2 circuits de 5.
  - **8 minutes par station, lecture de la vignette comprise.** La lecture est calibrée pour environ 1 minute, sans signal de fin de lecture.
  - 2 minutes de transition entre deux stations.
  - Le document Gemini propose une phase « 2 min de lecture + 7 min d'action » : **c'est faux**, ne l'implémente pas ainsi.
- **Chronomètre** (petite machine à états dans `lib/ecos-timer.js`, en fonctions pures et testées) :
  - états `pret → en_cours → termine` ;
  - 8:00 en tout ;
  - repère visuel doux à 7:00 restantes (« fin de lecture conseillée ») ;
  - alerte visuelle et sonore à 1:00 restante ;
  - signal sonore au début et à la fin, via Web Audio (un bip synthétisé, pas de fichier audio) ;
  - le chrono reste juste si l'onglet passe en arrière-plan : calcul sur `performance.now()` ou `Date.now()`, jamais par décrément d'un compteur.
  - Option « circuit » : enchaîner N stations avec 2 minutes de transition.
- **Grille.**
  ```json
  "grille": {
    "items": [ { "id": "g1", "critere": "…", "points": 1, "critique": false } ],
    "global": true
  }
  ```
  - `critique: true` met l'item en évidence au débriefing s'il est manqué.
  - **Pas de « zéro éliminatoire » automatique à 0/100** : aucune source officielle trouvée pour cette règle. Consigne ce choix.
  - `global: true` affiche une impression globale de 1 à 5 à cocher par l'examinateur.
- **Mode solo.**
  - Vignette et chrono.
  - Enregistrement audio optionnel via `MediaRecorder`. L'audio reste **en mémoire uniquement**, réécoutable et téléchargeable, **jamais envoyé sur Supabase**, pour ne pas consommer le quota de 1 Go.
  - À la fin du chrono : bouton « Révéler la grille », auto-pointage, score, enregistrement.
- **Mode binôme** (un seul appareil, tenu par l'examinateur ou posé entre les deux) :
  - sur desktop, écran partagé : candidat (vignette + chrono) / examinateur (script de l'interlocuteur + grille cochable en direct) ;
  - sur mobile, onglets fixes « Candidat » / « Examinateur » ;
  - pas de synchronisation temps réel entre deux appareils (hors périmètre).
- **Domaines de compétence** (10 des 11 du guide CNG) : annonce, communication interprofessionnelle, éducation / prévention, entretien / interrogatoire, examen clinique, iconographie, procédure, stratégie diagnostique, stratégie pertinente de prise en charge, synthèse des résultats d'examens paracliniques. Le 11e est à compléter par Sullivan : ajoute une ligne dans `A-FAIRE-SULLIVAN.md`.

### 5.10 Dossiers : règle du no-back et affichage

- **DP.**
  - Longueur libre : les DP comptent généralement 3 à 8 questions ; accepte de 2 à 15.
  - La barre de progression se découpe dynamiquement selon le nombre réel de questions.
  - La vignette reste visible. L'énoncé de la question N+1 n'apparaît qu'après validation de la question N.
  - Une fois validée, une question est **définitivement verrouillée** : ses champs sont désactivés et le bouton précédent est absent.
  - Désactive aussi `←` dans `resoudreRaccourci` pour ces routes, avec un test, et ajoute ces routes à la liste qui désactive `n`/`r`.
- **KFP.** Même moteur que le DP. Ce sont des dossiers courts centrés sur les décisions critiques, typiquement 3 questions mêlant QROC et QRU. Ne rends aucune composition obligatoire.
- **LCA.** Dossier de questions QRM ou QRU sur un article.
  - Desktop : article à gauche (iframe ou `<object>` sur `article_url`, avec lien d'ouverture de secours), questions défilantes à droite.
  - Mobile : onglets Article / Questions.
  - Les questions de LCA comptent **double** dans les statistiques, comme à l'officiel.
- **Correction.**
  - En mode entraînement, correction affichée après chaque question, sans possibilité de revenir en arrière.
  - En mode examen, rien n'est affiché avant la fin (§8, lot 6).
  - Code couleur : vert = coché juste ; rouge = coché faux ; neutre (bleu/gris) = vrai non coché. Réutilise les classes de correction de `qcm-jouer.js` si elles existent.
- **Chronomètre par question.** Discret, il ne bloque pas. Durée enregistrée dans `duree_s`.

### 5.11 Texte riche

- Réutilise `lib/richtext.js` (`**gras**`, `==surligné==`, `!!important!!`) et étends-le si nécessaire avec :
  - les **tableaux** markdown à barres verticales (indispensables pour les bilans biologiques) ;
  - les listes ;
  - `[[img:…]]` s'il n'est pas déjà géré hors des fiches.
- Tests dans `richtext.test.js`.
- **Bilans biologiques.** Les prompts imposent de présenter les bilans en tableau (paramètre | valeur | unité | normes) **sans jamais écrire l'interprétation** dans l'énoncé (« hyperkaliémie » etc.).
  - En entraînement, la colonne des normes est masquée par défaut, avec un bouton « Afficher les normes ».
  - C'est la version réaliste du « masquage biologique » du document Gemini.
- **Formules.** KaTeX seulement si `$…$` ou `$$…$$` est détecté, chargé en `await import('katex')` avec sa CSS. Si ça complique trop le build, reporte au lot 6 et consigne-le.

---

## 6. Import et banque de prompts externat

- **Nouvelles cibles dans `#import`** : `r2c_items`, `r2c_sdd`, `edn_dossiers` (avec leurs questions imbriquées), `edn_questions` (questions isolées), `ecos_stations`, `constantes_bio`. Même contrat que l'existant :
  - contrôles préalables ;
  - schémas zod dans `import-schemas.js`, **un schéma par format** de question, avec validation stricte de `contenu` selon `format` ;
  - tout-ou-rien ;
  - upsert partiel si l'id existe ;
  - zod chargé à la demande.
- **Validations métier supplémentaires**, avec tests :
  - QRU : exactement 1 proposition vraie ou indispensable.
  - QRM : au moins 1 proposition vraie.
  - QRP et QRP_LONG : nombre de vraies = `n`.
  - QRP_LONG : 10 à 25 propositions et aucun statut indispensable ni inacceptable.
  - ZAP : `x` entre 1 et 5.
  - TCS : les 5 clés de vote sont présentes et au moins un vote est non nul.
  - Les questions d'un dossier ont des `ordre` uniques.
  - Les items et SDD référencés existent : avertissement non bloquant, comme pour les matières inconnues.
  - Tags inconnus : même avertissement que l'existant.
- **Banque de prompts** dans `src/data/prompts/externat/`, affichée par la page Prompts en mode externat. Même style que les prompts P2 existants (lis `README-prompts.md` et `prompt-contexte-maitre.md` pour reprendre leur ton et leur structure) :
  - `prompt-r2c-items.md` et `prompt-r2c-sdd.md` : transforment une liste officielle collée par Sullivan en JSON d'import. Consigne explicite : ne rien ajouter qui ne soit pas dans le texte fourni.
  - `prompt-edn-qi.md` : questions isolées, avec un paramètre de format (QRU / QRM / QRP / QRP_LONG / QROC). Si le prompt devient trop long, un prompt par format.
  - `prompt-edn-dp.md`, `prompt-edn-kfp.md`, `prompt-edn-tcs.md`, `prompt-edn-lca.md`.
  - `prompt-edn-zap.md` : énoncé seulement, `zones: []`, en précisant que les zones se placent ensuite dans l'éditeur.
  - `prompt-ecos-station.md`.
  - `prompt-constantes-bio.md`.
- **Règles communes à tous les prompts de contenu** :
  - génération **exclusivement à partir du texte source fourni** (chapitre de collège, référentiel, recommandation) ;
  - interdiction d'inventer une recommandation ou un chiffre ;
  - `source: "genere"` ;
  - `date_reference` = année de l'édition ou de la recommandation citée dans le source, `null` si inconnue ;
  - champ `rang` obligatoire, déduit du source (les collèges marquent les rangs) ;
  - `items`/`sdd` renseignés quand le source les donne ;
  - distracteurs plausibles ;
  - statut `inacceptable` réservé aux propositions dangereuses pour le patient ;
  - explication pour chaque proposition ;
  - sortie : **uniquement** un tableau JSON brut, sans markdown.
- Ajoute à chaque prompt un **exemple JSON complet et valide** : un test vitest vérifie que l'exemple de chaque prompt passe le schéma zod correspondant. Ainsi, prompts et import ne peuvent pas diverger silencieusement.

---

## 7. Répétition espacée, tableau de bord, carnet d'erreurs

### 7.1 Algorithme (`src/lib/edn-srs.js`, pur et testé)

- **Paliers (« méthode des J »)** : J+1, J+3, J+7, J+14, J+30, J+60, J+120. Constante unique, facile à modifier.
- **Après chaque tentative sur une cible**, selon le score normalisé s = score / score_max :
  - s = 1 : palier suivant ;
  - 0,5 ≤ s < 1 : même palier, relancé à partir d'aujourd'hui ;
  - s < 0,5 : retour au premier palier (J+1).
- **Items prioritaires** : si la cible touche un item `prioritaire`, il faut **3 réussites parfaites consécutives** avant de passer au palier suivant. Pendant ce temps, la cible revient à J+1.
- **Première rencontre** : une cible jamais tentée n'est pas « due ». Elle entre dans le SRS à sa première tentative.
- **Plafond anti-surcharge.**
  - Réglage « révisions max / jour », 100 par défaut, dans Paramètres, section externat.
  - Au-delà du plafond, les cibles dues sont triées par priorité (item prioritaire d'abord, puis retard le plus ancien), et le reste est reporté.
  - Après une longue absence, le retard se résorbe donc sur plusieurs jours sans jamais afficher un mur de 1 000 cartes.
- Une cible **suspendue** sort du SRS (bouton dans la banque).
- Le mode `flash` met aussi à jour le SRS.

### 7.2 Tableau de bord externat (accueil en mode externat)

- **Révisions dues aujourd'hui**, dans la limite du plafond, et un bouton « Commencer ».
- **Série Flash** : gros bouton qui lance immédiatement 5 cibles dues, en prenant les questions isolées de préférence (les plus courtes). S'il n'y a rien de dû, il prend 5 questions isolées au hasard parmi celles déjà tentées. C'est l'usage en stage « dans l'ascenseur ».
- **Raccourcis** : Série de questions isolées (filtres : spécialité, item, SDD, rang, format, source, tags, « jamais faites », « ratées ») · Dossiers (DP / KFP / TCS / LCA) · ECOS · Banque · Carnet d'erreurs.
- Le streak existant reste affiché, avec le même fonctionnement.
- **Pas de système XP / niveaux** (écarté volontairement : le streak existe déjà et les statistiques suffisent). Consigne ce choix.

### 7.3 Banque (`#edn-banque`)

- Liste des questions et dossiers en `.fiche-row`, avec filtres (spécialité, item, SDD, rang, format, source, statut, tags, date de référence).
- Une ligne donne accès : aperçu, suspendre/réactiver le SRS, modifier le statut et les tags, et pour une ZAP, lien vers l'éditeur de zones.
- Pour les dossiers, filtre « Signaler une erreur » sur le même principe que les fiches (`a_corriger` + note). Si tu l'ajoutes, ajoute la colonne dans la migration du lot 1.

### 7.4 Carnet d'erreurs

- Étends le carnet existant avec une section externat. Ne le duplique pas.
- **Qualification des erreurs.** Après une question ratée (s < 1), une ligne de chips permet de choisir **au moins un tag d'erreur** avant de passer à la suite, en un tap ou avec les touches 1 à 6.
  - Liste par défaut, modifiable dans Paramètres et stockée en préférence : Biais de lecture · Oubli de cours · Confusion · Méconnaissance (jamais appris) · Précipitation · Rang B.
  - Le tag est obligatoire en mode entraînement, et **désactivé en mode flash et en mode examen** (où il est proposé au bilan de fin).
- Filtres : par tag d'erreur, spécialité, item, format.
- Bouton « Refaire ces erreurs », sur le même mécanisme de retry que l'existant.

---

## 8. Découpage en lots

### Phase 1 (première session)

- **Lot 1 : Fondations.**
  - Branche `externat-v2`.
  - `docs/externat/DECISIONS.md` et `docs/externat/A-FAIRE-SULLIVAN.md`.
  - **Toutes** les migrations du §4.
  - `lib/cycle.js`, carte Paramètres, badge dans la topbar, navigation conditionnelle, pages externat vides mais routées avec la dégradation propre.
  - Vérification que le mode P2 est strictement inchangé.
- **Lot 2 : Référentiels et import.**
  - Cibles d'import, schémas zod par format et validations métier, avec leurs tests.
  - Prompts `r2c-items` / `r2c-sdd`.
  - Gestion du flag `prioritaire` (page Items R2C simple : liste, recherche, bascule du flag).
- **Lot 3 : Moteur.**
  - `edn-scoring.js` avec **tous** les tests officiels du §5.
  - Rendu et interaction des 7 formats.
  - Joueur de questions isolées.
  - Joueur de dossiers DP/KFP/TCS avec no-back.
  - Éditeur ZAP.
  - Texte riche étendu (tableaux) et masquage des normes.
  - Raccourcis clavier des nouveaux écrans, dans `resoudreRaccourci`, avec tests.
- **Lot 4 : Rétention.**
  - `edn-srs.js` et ses tests.
  - Tableau de bord externat, Série Flash, Banque.
  - Carnet d'erreurs étendu avec les tags.
  - Tous les prompts de contenu du §6, avec le test « exemple valide ».
  - Mise à jour de `CLAUDE.md`.
  - PR vers `main`.

### Phase 2 (deuxième session, lancée après les retours de Sullivan sur la phase 1)

- **Lot 5 : ECOS.** Tout le §5.9.
- **Lot 6 : Conditions d'examen.**
  - LCA (écran partagé).
  - Mode **examen** : compte à rebours global configurable, soumission forcée à zéro, aucune correction avant la fin.
  - Option **« Simulateur UNESS »** : thème clair et sobre, limité à l'écran d'examen, sans fond d'écran, sans verre dépoli ni couleurs de feedback. C'est une classe sur le conteneur de l'examen, pas un thème global.
  - Modale **Constantes biologiques** accessible depuis tous les écrans externat (bouton flottant et raccourci clavier libre, vérifié dans le résolveur).
  - KaTeX si reporté.
- **Lot 7 : Statistiques et exports.**
  - Page Stats externat : réussite par spécialité, item, format et rang ; **note AA estimée** comparée au seuil de 14/20 ; LCA comptée double ; ECOS par domaine.
  - **Courbe de réussite selon l'heure de la journée et la durée de session** (le « fatigue score », calculé à partir de `date_tentative` et `duree_s` sans nouvelle donnée), avec un message factuel si l'écart est net.
  - Filtre d'obsolescence : questions dont `date_reference` est antérieure à une année réglable.
  - **Exports** :
    - CSV compatible avec l'import d'Anki (recto = énoncé, verso = correction + explication), pas de `.apkg` ;
    - PDF « mes erreurs » via le **jsPDF existant** (`lib/pdf.js`), pas `@react-pdf`.
- **Lot 8 : Hors-ligne (PWA).**
  - Service worker qui met en cache l'application.
    - Vérifie d'abord que `vite-plugin-pwa` est compatible avec **Vite 8**. Sinon, écris un service worker minimal à la main et consigne le choix.
    - Mets à jour le `site.webmanifest` existant plutôt que d'en créer un second.
  - Bouton « Préparer le hors-ligne » : télécharge dans IndexedDB les cibles dues du jour (au plafond) et leurs images.
  - **Tentatives hors-ligne** : mises en file dans IndexedDB avec leur `id` UUID client et leur `date_tentative` locale. Rejouées au retour du réseau par un **insert idempotent** (`upsert` avec `ignoreDuplicates` sur `id`), puis recalcul du SRS des cibles concernées en rejouant les tentatives **triées par `date_tentative`**.
  - Comme les tentatives sont append-only, deux appareils ne peuvent pas s'écraser mutuellement : c'est plus simple et plus sûr que la résolution par `updated_at` du document Gemini.
  - Indicateur discret « hors-ligne · N en attente ».

---

## 9. Points d'attention transverses

- **Quota de stockage Supabase gratuit (1 Go).**
  - Images ZAP et iconographie : on garde le pipeline `images.js`, qui conserve les PNG sans perte.
  - Articles de LCA : URL externe de préférence ; l'upload reste possible mais doit être signalé comme coûteux.
  - Ajoute dans Paramètres, section externat, une ligne indicative du nombre d'objets et de leur taille, si l'API Storage le permet simplement.
- **Sécurité.** RLS sur toutes les nouvelles tables. Si `scripts/audit-rls.mjs` liste les tables, mets-le à jour.
- **Accessibilité.** Tout ce qui se fait au clic se fait aussi au clavier (cohérent avec les raccourcis existants) et au doigt (cibles ≥ 44 px).
- **Tests.** Priorité aux fonctions pures (notation, SRS, chronomètre ECOS, normalisation QROC, conversion des coordonnées ZAP, résolveur de raccourcis, schémas d'import). Si Playwright est disponible dans l'environnement, vérifie aussi en 375 px et 1280 px les écrans joueur de dossier, ZAP et ECOS.
- **Fin de chaque phase.**
  - `CLAUDE.md` à jour : décision SRS, modèle externat, nouveaux pièges rencontrés.
  - `A-FAIRE-SULLIVAN.md` complet et ordonné.
  - PR ouverte, **non fusionnée**.

---

## 10. Prompts de lancement (à coller dans Claude Code)

### Phase 1

```
Lis entièrement docs/externat/SPEC-EXTERNAT-V2.md, puis CLAUDE.md et les fichiers listés
en §0 de la spec. Réalise la PHASE 1 (lots 1 à 4) en autonomie complète, dans l'ordre,
sur la branche externat-v2 : un commit par lot minimum, npm test et npm run build verts
avant chaque commit. Ne t'arrête pas pour poser des questions : consigne tes arbitrages
dans docs/externat/DECISIONS.md et continue. Tu n'as pas accès à ma base Supabase :
écris les migrations dans supabase/migrations/ et tout ce que je dois faire moi-même
dans docs/externat/A-FAIRE-SULLIVAN.md. Le mode P2 ne doit subir aucune régression.
Termine par une PR vers main (non fusionnée) avec un résumé par lot.
```

### Phase 2 (après que Sullivan a appliqué et testé la phase 1)

```
Relis docs/externat/SPEC-EXTERNAT-V2.md, CLAUDE.md, docs/externat/DECISIONS.md et
docs/externat/A-FAIRE-SULLIVAN.md. La phase 1 est fusionnée. Voici mes retours : [RETOURS].
Intègre d'abord ces retours, puis réalise la PHASE 2 (lots 5 à 8) avec les mêmes règles
qu'en phase 1 : branche externat-v2-phase2, un commit par lot, tests et build verts,
arbitrages consignés, PR finale non fusionnée.
```
