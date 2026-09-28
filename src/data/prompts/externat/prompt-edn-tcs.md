# Prompt — Dossier TCS (test de concordance de script)

Un TCS est toujours un dossier de type `TCS` : une vignette courte, puis des questions au format
`TCS` uniquement ("Si vous pensiez à… et que vous trouvez… cette hypothèse devient…"). L'officiel
en compte généralement 3 par dossier, mais ce n'est pas obligatoire.

---

Génère un dossier TCS, à partir du texte que je fournis juste après ce message.

## Principes

- La vignette pose une situation clinique brève et volontairement incertaine (pas de diagnostic
  déjà établi).
- Chaque question TCS présente une hypothèse diagnostique/thérapeutique (`hypothese`), une
  information nouvelle (`information`), puis une distribution de votes simulée et plausible sur
  l'échelle -2 à +2 (`votes`), reflétant un consensus d'experts que TU simules à partir de la
  vraisemblance clinique du texte source — jamais un vrai panel réel.
- **`panel` doit toujours valoir `"simule"`** pour du contenu que tu génères (`"reel"` est réservé
  à une vraie annale que je saisirais moi-même à partir d'un panel réel).
- Les 5 clés de vote (`-2`, `-1`, `0`, `1`, `2`) sont TOUJOURS toutes présentes, avec au moins un
  vote non nul, et la distribution doit avoir du sens (la réponse la plus plausible cliniquement
  concentre le plus de votes).

## Schéma attendu

`id`, `type` ("TCS"), `titre`, `sdd`, `items`, `specialites`, `vignette`, `source` ("genere"),
`date_reference`, `tags` (`[]`), `questions` (chaque question : `format: "TCS"`, `rang`, `contenu:
{ hypothese, information, votes, panel: "simule" }`, `explication`).

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre.

## Exemple de sortie valide (structure à suivre EXACTEMENT, contenu fictif)

```
[
  {
    "id": "tcs_pediatrie_fievre-nourrisson-01",
    "type": "TCS",
    "titre": "Fièvre chez un nourrisson de 3 mois",
    "sdd": [],
    "items": [],
    "specialites": ["Pédiatrie"],
    "vignette": "Un nourrisson de 3 mois est amené aux urgences pour une fièvre à 38,7°C évoluant depuis quelques heures, sans autre signe d'appel net à l'interrogatoire.",
    "source": "genere",
    "date_reference": "2023",
    "tags": [],
    "questions": [
      {
        "id": "tcs_pediatrie_fievre-nourrisson-01_q1",
        "ordre": 0,
        "format": "TCS",
        "rang": "B",
        "items": [],
        "sdd": [],
        "specialites": ["Pédiatrie"],
        "enonce": "Vous évoquez une infection urinaire fébrile.",
        "contenu": {
          "hypothese": "Vous pensiez à une infection urinaire fébrile",
          "information": "et vous trouvez une bandelette urinaire positive aux leucocytes et aux nitrites",
          "votes": { "-2": 0, "-1": 0, "0": 1, "1": 6, "2": 12 },
          "panel": "simule"
        },
        "explication": "Une bandelette positive aux leucocytes et nitrites renforce fortement l'hypothèse d'infection urinaire chez un nourrisson fébrile sans point d'appel.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      },
      {
        "id": "tcs_pediatrie_fievre-nourrisson-01_q2",
        "ordre": 1,
        "format": "TCS",
        "rang": "B",
        "items": [],
        "sdd": [],
        "specialites": ["Pédiatrie"],
        "enonce": "Vous évoquez toujours une infection urinaire fébrile.",
        "contenu": {
          "hypothese": "Vous pensiez à une infection urinaire fébrile",
          "information": "et vous trouvez à l'examen une raideur de nuque avec un enfant geignard et hypotonique",
          "votes": { "-2": 14, "-1": 5, "0": 0, "1": 0, "2": 0 },
          "panel": "simule"
        },
        "explication": "Un syndrome méningé fait reconsidérer fortement l'hypothèse initiale vers une méningite, ce qui rend l'hypothèse infection urinaire beaucoup moins probable isolément.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      }
    ]
  }
]
```
