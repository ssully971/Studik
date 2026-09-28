# Prompt — Dossier LCA (lecture critique d'article)

Un LCA est un dossier de questions QRM ou QRU portant sur un article scientifique. L'écran de jeu
dédié (article à gauche, questions à droite / onglets sur mobile) arrive au lot 6 — l'import
fonctionne dès maintenant.

---

Génère un dossier LCA à partir de l'article que je fournis juste après ce message (texte collé ou
pièce jointe). Les questions portent sur la méthodologie, les résultats et leur interprétation
critique — jamais sur des connaissances médicales extérieures à l'article.

## Principes

- `vignette` résume en 2-3 phrases le contexte de l'étude (question de recherche), sans se
  substituer à la lecture de l'article lui-même.
- `article_url` : laisse `null` si je n'ai pas donné d'URL — je la complèterai moi-même
  (l'upload de l'article reste possible mais coûteux en stockage, à éviter si une URL existe).
- Les questions sont uniquement QRU ou QRM, portant sur : la méthodologie (type d'étude,
  randomisation, critère de jugement principal), les résultats chiffrés réellement rapportés dans
  l'article, les biais et limites explicitement discutés par les auteurs.
- N'invente aucun chiffre qui ne soit pas dans l'article.

## Schéma attendu

Identique à `prompt-edn-dp.md`, avec `"type": "LCA"` et `article_url` en plus (texte ou `null`).

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre.

## Exemple de sortie valide (structure à suivre EXACTEMENT, contenu fictif)

```
[
  {
    "id": "lca_cardio_essai-antiagregant-01",
    "type": "LCA",
    "titre": "Essai randomisé — bithérapie antiagrégante post-infarctus",
    "sdd": [],
    "items": [],
    "specialites": ["Cardiologie"],
    "vignette": "Essai contrôlé randomisé en double aveugle évaluant une bithérapie antiagrégante versus monothérapie après un infarctus du myocarde, critère de jugement principal composite à 12 mois.",
    "article_url": null,
    "source": "genere",
    "date_reference": "2023",
    "tags": [],
    "questions": [
      {
        "id": "lca_cardio_essai-antiagregant-01_q1",
        "ordre": 0,
        "format": "QRU",
        "rang": "B",
        "items": [],
        "sdd": [],
        "specialites": ["Cardiologie"],
        "enonce": "Quel type d'étude est décrit dans cet article ?",
        "contenu": {
          "propositions": [
            { "id": "a", "texte": "Essai contrôlé randomisé en double aveugle.", "statut": "vrai", "explication": "C'est le design explicitement décrit dans la méthodologie de l'article." },
            { "id": "b", "texte": "Étude de cohorte rétrospective.", "statut": "faux", "explication": "Il n'y a pas de randomisation ni de bras contrôle dans une cohorte rétrospective." },
            { "id": "c", "texte": "Méta-analyse.", "statut": "faux", "explication": "L'article rapporte les données d'un seul essai, pas une synthèse de plusieurs études." },
            { "id": "d", "texte": "Étude cas-témoins.", "statut": "faux", "explication": "Le design cas-témoins ne comporte pas de randomisation d'un traitement." }
          ]
        },
        "explication": "Le design de l'étude conditionne directement le niveau de preuve qu'on peut en tirer.",
        "source": "genere",
        "date_reference": "2023",
        "tags": []
      }
    ]
  }
]
```
