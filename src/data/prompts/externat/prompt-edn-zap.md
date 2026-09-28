# Prompt — Question ZAP (zone à pointer)

Génère seulement l'énoncé : les zones se posent ensuite dans l'éditeur dédié (`#edn-zap/:id`,
seule exception au principe "pas de saisie dans l'UI" — des coordonnées de clic ne peuvent pas
venir d'un JSON généré par une IA).

---

Génère une question au format ZAP (zone à pointer sur une image), à partir du texte que je
fournis juste après ce message.

## Schéma attendu (un tableau JSON, un seul objet en général)

- `id`, `rang`, `items`, `sdd`, `specialites`, `enonce` (précise clairement ce qu'il faut pointer
  sur l'image, et le nombre de points attendus), `explication`, `source` ("genere"),
  `date_reference`, `tags` (`[]`).
- `contenu.x` : nombre de points que le candidat peut poser (1 à 5), déduit de l'énoncé.
- `contenu.zones` : TOUJOURS `[]` à l'import. Ne propose jamais de coordonnées : je les pose moi-même
  ensuite dans l'éditeur, une fois l'image téléversée.
- Ne mets pas de champ `image` : je le téléverse moi-même après import, dans l'éditeur de zones.

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre.

## Exemple de sortie valide (structure à suivre EXACTEMENT, contenu fictif)

```
[
  {
    "id": "zap_anatomie_coupe-thoracique-01",
    "format": "ZAP",
    "rang": "A",
    "items": [],
    "sdd": [],
    "specialites": ["Anatomie"],
    "enonce": "Sur cette coupe scanographique thoracique, pointe l'aorte descendante.",
    "contenu": {
      "x": 1,
      "zones": []
    },
    "explication": "L'aorte descendante est visible en arrière et à gauche du rachis sur une coupe axiale thoracique.",
    "source": "genere",
    "date_reference": "2023",
    "tags": []
  }
]
```
