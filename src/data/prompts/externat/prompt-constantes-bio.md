# Prompt — Constantes biologiques

Génère une liste de valeurs biologiques normales, à partir d'un tableau de référence officiel que
je fournis (collège, item R2C dédié aux valeurs normales, etc.). N'invente AUCUNE valeur qui ne
soit pas dans la source.

---

Transforme le tableau de valeurs biologiques normales que je fournis juste après ce message en
JSON d'import pour Studik.

## Schéma attendu (un tableau JSON, un objet par paramètre)

- `id` : identifiant stable (ex. `bio_ionogramme_natremie`).
- `categorie` : le regroupement tel que présenté dans la source (ex. "Ionogramme sanguin",
  "Numération formule sanguine").
- `parametre` : le nom du paramètre (ex. "Natrémie").
- `valeur_normale` : la fourchette ou la valeur telle qu'écrite dans la source (texte, pas un
  nombre — certaines valeurs sont des fourchettes, d'autres des seuils).
- `unite` : l'unité telle qu'écrite dans la source, `null` si sans unité.
- `ordre` : la position dans la source, pour garder le même classement à l'affichage.

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre.

## Exemple de sortie valide (structure à suivre EXACTEMENT, contenu fictif)

```
[
  { "id": "bio_ionogramme_natremie", "categorie": "Ionogramme sanguin", "parametre": "Natrémie", "valeur_normale": "135-145", "unite": "mmol/L", "ordre": 1 },
  { "id": "bio_ionogramme_kaliemie", "categorie": "Ionogramme sanguin", "parametre": "Kaliémie", "valeur_normale": "3,5-4,5", "unite": "mmol/L", "ordre": 2 },
  { "id": "bio_nfs_hemoglobine", "categorie": "Numération formule sanguine", "parametre": "Hémoglobine (homme)", "valeur_normale": "13-17", "unite": "g/dL", "ordre": 1 }
]
```
