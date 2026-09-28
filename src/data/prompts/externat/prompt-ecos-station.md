# Prompt — Station ECOS

Le joueur ECOS (chronomètre, mode solo/binôme) arrive au lot 5 — l'import et la Banque fonctionnent
dès maintenant.

---

Génère une station ECOS à partir du texte que je fournis juste après ce message (guide du candidat
CNG, référentiel de compétence, ou cas clinique source).

## Principes

- `domaine` : un des domaines de compétence du guide CNG (annonce, communication
  interprofessionnelle, éducation/prévention, entretien/interrogatoire, examen clinique,
  iconographie, procédure, stratégie diagnostique, stratégie pertinente de prise en charge,
  synthèse des résultats d'examens paracliniques — ou un 11e domaine que je complèterai
  moi-même).
- `vignette` : ce que lit le candidat avant d'entrer (consigne + contexte).
- `consignes_examinateur` : ce que l'examinateur doit savoir sans le dire au candidat.
- `script_interlocuteur` : si `interlocuteur` n'est pas "aucun", les répliques que le patient
  standardisé doit tenir (adaptées à ce qu'il/elle doit révéler progressivement).
- `grille.items` : critères notables un par un, `points` cohérents avec l'importance du critère,
  `critique: true` réservé aux critères dont l'omission serait dangereuse pour un patient réel
  (mis en évidence au débriefing).
- Pas de "zéro éliminatoire" à coder : aucune règle de ce type n'existe côté site.

## Schéma attendu (un tableau JSON, un objet par station)

`id`, `titre`, `sdd`, `domaine`, `interlocuteur` ("PS" | "PSS" | "aucun"), `vignette`,
`consignes_examinateur`, `script_interlocuteur`, `documents` (`[]` sauf si la source décrit un
document précis à remettre), `grille: { items: [...], global: true }`, `source` ("genere"),
`tags` (`[]`).

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre.

## Exemple de sortie valide (structure à suivre EXACTEMENT, contenu fictif)

```
[
  {
    "id": "ecos_annonce_diagnostic-diabete-01",
    "titre": "Annonce d'un diabète de type 2",
    "sdd": [],
    "domaine": "annonce",
    "interlocuteur": "PS",
    "vignette": "Vous êtes interne aux urgences. Un patient de 54 ans vient chercher les résultats de son bilan biologique prescrit pour asthénie. La glycémie à jeun est à 2,10 g/L, confirmée sur un second prélèvement.",
    "consignes_examinateur": "Le patient ignore tout du diagnostic. Attendez-vous à une réaction d'inquiétude, voire de déni. Le candidat doit annoncer le diagnostic avec tact, vérifier la compréhension et proposer un suivi.",
    "script_interlocuteur": "Le patient standardisé exprime d'abord de l'inquiétude (\"c'est grave docteur ?\"), puis, si le candidat rassure sans expliquer, insiste pour comprendre ce que cela implique au quotidien.",
    "documents": [],
    "grille": {
      "items": [
        { "id": "g1", "critere": "Annonce le diagnostic de façon claire et compréhensible", "points": 2, "critique": true },
        { "id": "g2", "critere": "Vérifie la compréhension du patient (reformulation)", "points": 1, "critique": false },
        { "id": "g3", "critere": "Aborde le retentissement au quotidien sans dramatiser", "points": 1, "critique": false },
        { "id": "g4", "critere": "Propose un suivi structuré (consultation dédiée, éducation thérapeutique)", "points": 2, "critique": false }
      ],
      "global": true
    },
    "source": "genere",
    "tags": []
  }
]
```
