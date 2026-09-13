# Prompt — Cas d'entraînement (Studik)

À REMPLIR AVANT D'ENVOYER :
- Type de cas : [clinique / mecanisme / structure]
- Matière exacte : [MATIÈRE]
- Tags autorisés (liste fermée, n'en utilise aucun autre — laisse vide si tu ne veux pas taguer) : [TAG1, TAG2, TAG3, ...]
- Source jointe (le cours sur lequel baser le cas) : [PDF / photo / texte collé / mes propres notes]
- Niveau imposé (optionnel — sinon l'IA choisit elle-même entre 1 et 3) : [1 / 2 / 3 / laisse vide]

---

Tu es chargé de créer un cas d'entraînement court au format JSON, à partir du cours fourni, pour un référentiel personnel de médecine.

RÈGLES DE FOND
- Base-toi en priorité sur le document ou le texte fourni pour construire un cas réaliste et cohérent avec ce qui y est enseigné.
- Tu peux t'appuyer sur tes connaissances médicales générales pour rendre le cas réaliste, mais reste factuellement exact et évite tout ce qui n'est pas médicalement défendable.
- Si le cours ne permet pas de construire un cas fiable, mets `"statut": "brouillon"` et indique-le en une phrase à la fin du champ "situation".
- Choisis toi-même le niveau de difficulté (1 = signe/notion évidente, 2 = combinaison de 2-3 éléments, 3 = présentation atypique ou piège classique), sauf si un niveau est imposé ci-dessus.
- Laisse le champ "fiches_liees" vide (`[]`) — il sera rempli manuellement plus tard.
- N'utilise que les tags listés ci-dessus, dans le champ "Tags autorisés". N'en invente aucun autre. Si aucun tag n'est listé, laisse `"tags": []`.
- Dans "reponse_attendue", les éléments marqués `"correct": false` doivent être des éléments plausibles mais absents du cas (pas des absurdités faciles à écarter) — ça doit être un vrai exercice de discrimination.

IDENTIFIANT
Construis "id" selon ce format : `cas_prefixe-matiere_nom-court`
- minuscules uniquement, sans accents, mots séparés par des tirets
- exemple : `cas_semio-cardio_insuffisance-cardiaque-01`

---

## Si le type est "clinique"

```
[
  {
    "id": "...",
    "type": "clinique",
    "matiere": "[MATIÈRE]",
    "niveau": 1,
    "fiches_liees": [],
    "tags": [],
    "enonce": {
      "situation": "Présentation du patient : âge, sexe, contexte, motif de consultation.",
      "elements": [
        "Élément d'interrogatoire ou d'examen n°1",
        "Élément d'interrogatoire ou d'examen n°2",
        "..."
      ]
    },
    "question": "Quels signes reconnaissez-vous dans cette observation ? Quelles pathologies sont compatibles avec ce tableau ?",
    "reponse_attendue": {
      "signes": [
        { "label": "Signe présent dans le cas", "correct": true },
        { "label": "Signe plausible mais absent du cas", "correct": false }
      ],
      "pathologies": ["Pathologie compatible 1", "Pathologie compatible 2"]
    },
    "statut": "valide"
  }
]
```

## Si le type est "mecanisme"

```
[
  {
    "id": "...",
    "type": "mecanisme",
    "matiere": "[MATIÈRE]",
    "niveau": 1,
    "fiches_liees": [],
    "tags": [],
    "enonce": {
      "situation": "Situation physiopathologique ou thérapeutique : contexte, molécule ou perturbation en jeu.",
      "elements": [
        "Élément déclencheur ou donnée du contexte n°1",
        "..."
      ]
    },
    "question": "Que se passe-t-il au niveau physiologique/cellulaire dans cette situation ? Quelles conséquences cliniques attendre ?",
    "reponse_attendue": {
      "evenements": [
        { "label": "Événement physiologique réellement déclenché", "correct": true },
        { "label": "Événement plausible mais qui ne se produit pas ici", "correct": false }
      ],
      "consequences": ["Conséquence clinique attendue 1", "Conséquence clinique attendue 2"]
    },
    "statut": "valide"
  }
]
```

## Si le type est "structure"

```
[
  {
    "id": "...",
    "type": "structure",
    "matiere": "[MATIÈRE]",
    "niveau": 1,
    "fiches_liees": [],
    "tags": [],
    "enonce": {
      "situation": "Description ou mise en situation permettant d'identifier la structure (repère anatomique, contexte clinique ou chirurgical).",
      "elements": [
        "Indice ou repère n°1",
        "..."
      ]
    },
    "question": "Identifiez la structure concernée, ses rapports, et sa fonction.",
    "reponse_attendue": {
      "elements": [
        { "label": "Caractéristique ou rapport correct", "correct": true },
        { "label": "Caractéristique plausible mais incorrecte", "correct": false }
      ],
      "identification": ["Nom de la structure à identifier"]
    },
    "statut": "valide"
  }
]
```

---

IMPORTANT — FORMAT DE RÉPONSE
Utilise uniquement le gabarit correspondant au type demandé ci-dessus. Réponds UNIQUEMENT avec le JSON rempli, rien d'autre : pas de phrase d'introduction, pas de commentaire, pas de balises markdown (pas de ```). Je dois pouvoir copier ta réponse telle quelle dans le site.
