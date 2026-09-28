# Prompt — Dossier KFP (décisions critiques)

Même moteur que le DP (`prompt-edn-dp.md`) : un dossier court centré sur les décisions critiques,
typiquement 3 questions mêlant QROC et QRU. Aucune composition n'est obligatoire — adapte au texte
source.

---

Génère un dossier KFP, à partir du texte que je fournis juste après ce message. Applique les mêmes
principes que pour un DP (vignette, questions imbriquées avec `ordre` unique, dévoilement
progressif de l'information), mais reste court et centré sur 2-3 décisions vraiment critiques
plutôt que sur un parcours clinique complet.

## Schéma attendu

Identique à `prompt-edn-dp.md`, seul `"type": "KFP"` change.

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre.

## Exemple de sortie valide (structure à suivre EXACTEMENT, contenu fictif)

```
[
  {
    "id": "kfp_urgences_choc-anaphylactique-01",
    "type": "KFP",
    "titre": "Choc anaphylactique en salle d'attente",
    "sdd": [],
    "items": [],
    "specialites": ["Urgences"],
    "vignette": "Une patiente de 32 ans présente brutalement un urticaire généralisé, une dyspnée sifflante et une hypotension à 70/40 mmHg après une injection d'antibiotique.",
    "source": "genere",
    "date_reference": "2023",
    "tags": [],
    "questions": [
      {
        "id": "kfp_urgences_choc-anaphylactique-01_q1",
        "ordre": 0,
        "format": "QROC",
        "rang": "A",
        "items": [],
        "sdd": [],
        "specialites": ["Urgences"],
        "enonce": "Quel traitement injecter en priorité et en urgence absolue ?",
        "contenu": { "exactes": ["adrenaline"], "acceptables": [] },
        "explication": "L'adrénaline intramusculaire est le traitement de première intention du choc anaphylactique, à administrer sans délai.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      },
      {
        "id": "kfp_urgences_choc-anaphylactique-01_q2",
        "ordre": 1,
        "format": "QRU",
        "rang": "A",
        "items": [],
        "sdd": [],
        "specialites": ["Urgences"],
        "enonce": "Quelle est la voie d'administration recommandée en première intention ?",
        "contenu": {
          "propositions": [
            { "id": "a", "texte": "Intramusculaire, face antéro-latérale de la cuisse.", "statut": "vrai", "explication": "Voie recommandée en première intention, résorption rapide et fiable." },
            { "id": "b", "texte": "Intraveineuse directe systématique.", "statut": "faux", "explication": "Réservée aux situations réfractaires, sous surveillance scopée stricte." },
            { "id": "c", "texte": "Sous-cutanée.", "statut": "faux", "explication": "Résorption trop lente en situation d'urgence vitale." },
            { "id": "d", "texte": "Orale.", "statut": "faux", "explication": "Inefficace en urgence vitale (dégradation digestive, délai d'action)." }
          ]
        },
        "explication": "La voie intramusculaire est recommandée en première intention devant un choc anaphylactique.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      }
    ]
  }
]
```
