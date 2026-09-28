# Prompt — Dossier progressif (DP)

Génère un dossier complet avec ses questions imbriquées, à partir d'un cas clinique construit sur
le texte source que je fournis. 3 à 8 questions typiquement (2 à 15 acceptées), mêlant les formats
que tu juges pertinents (QRU/QRM/QRP/QRP_LONG/QROC/ZAP — pas TCS, réservé au format dossier TCS,
voir `prompt-edn-tcs.md`).

---

Génère un dossier progressif (DP), à partir du texte que je fournis juste après ce message.

## Principes

- La `vignette` est le contexte initial (motif de consultation, antécédents utiles).
- Chaque question de `questions` représente une étape : l'énoncé de la question N+1 dévoile une
  information nouvelle (résultat d'examen, évolution), jamais visible avant que le candidat n'ait
  validé la question N.
- `ordre` de chaque question = sa position (0, 1, 2…), toujours unique dans le dossier.
- Applique pour chaque question les mêmes règles de format que dans `prompt-edn-qi.md`
  (statuts, `n`, bornes de propositions).
- Pour un bilan biologique dans l'énoncé d'une question, présente-le en tableau markdown à barres
  verticales `paramètre | valeur | unité | normes` (jamais l'interprétation en clair).

## Schéma attendu (un tableau JSON, un objet dossier par dossier)

`id`, `type` ("DP"), `titre`, `sdd`, `items`, `specialites`, `vignette`, `source` ("genere"),
`date_reference`, `tags` (`[]`), `questions` (tableau, chaque question a son propre `id`/`ordre`
en plus des champs habituels — pas de `dossier_id`, ajouté automatiquement à l'import).

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre.

## Exemple de sortie valide (structure à suivre EXACTEMENT, contenu fictif)

```
[
  {
    "id": "dp_cardio_douleur-thoracique-01",
    "type": "DP",
    "titre": "Douleur thoracique aux urgences",
    "sdd": [],
    "items": [],
    "specialites": ["Cardiologie"],
    "vignette": "Un homme de 58 ans, tabagique, consulte pour une douleur thoracique constrictive apparue il y a 1 heure, irradiant dans le bras gauche.",
    "source": "genere",
    "date_reference": "2023",
    "tags": [],
    "questions": [
      {
        "id": "dp_cardio_douleur-thoracique-01_q1",
        "ordre": 0,
        "format": "QROC",
        "rang": "A",
        "items": [],
        "sdd": [],
        "specialites": ["Cardiologie"],
        "enonce": "Quel examen complémentaire réaliser en priorité, dans les 10 minutes ?",
        "contenu": { "exactes": ["electrocardiogramme"], "acceptables": ["ecg"] },
        "explication": "L'ECG doit être réalisé et interprété en moins de 10 minutes devant toute douleur thoracique.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      },
      {
        "id": "dp_cardio_douleur-thoracique-01_q2",
        "ordre": 1,
        "format": "QRU",
        "rang": "A",
        "items": [],
        "sdd": [],
        "specialites": ["Cardiologie"],
        "enonce": "L'ECG montre un sus-décalage de ST en antérieur. Quelle est la prise en charge la plus adaptée ?",
        "contenu": {
          "propositions": [
            { "id": "a", "texte": "Angioplastie coronaire en urgence.", "statut": "vrai", "explication": "Reperfusion la plus rapide possible, traitement de référence du STEMI." },
            { "id": "b", "texte": "Surveillance simple avec ECG de contrôle à 24h.", "statut": "faux", "explication": "Retarderait dangereusement la reperfusion." },
            { "id": "c", "texte": "Épreuve d'effort dès que la douleur cède.", "statut": "faux", "explication": "Contre-indiquée en phase aiguë de STEMI." },
            { "id": "d", "texte": "Antibiothérapie probabiliste.", "statut": "faux", "explication": "Aucune indication infectieuse ici." }
          ]
        },
        "explication": "Le STEMI impose une reperfusion la plus rapide possible, idéalement par angioplastie primaire.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      },
      {
        "id": "dp_cardio_douleur-thoracique-01_q3",
        "ordre": 2,
        "format": "QRM",
        "rang": "B",
        "items": [],
        "sdd": [],
        "specialites": ["Cardiologie"],
        "enonce": "Parmi les traitements suivants, lesquels font partie de la prise en charge médicamenteuse initiale ?",
        "contenu": {
          "propositions": [
            { "id": "a", "texte": "Aspirine.", "statut": "indispensable", "explication": "Antiagrégant plaquettaire systématique." },
            { "id": "b", "texte": "Anticoagulation par héparine.", "statut": "vrai", "explication": "Recommandée en complément de l'antiagrégation." },
            { "id": "c", "texte": "Corticothérapie systémique.", "statut": "inacceptable", "explication": "Aucune indication et potentiellement délétère en phase aiguë." },
            { "id": "d", "texte": "Antitussifs systématiques.", "statut": "faux", "explication": "Pas d'indication dans ce contexte." }
          ]
        },
        "explication": "La prise en charge médicamenteuse initiale du SCA associe antiagrégation et anticoagulation.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      }
    ]
  }
]
```
