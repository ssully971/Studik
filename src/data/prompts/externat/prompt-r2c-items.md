# Prompt — Items R2C

À utiliser une seule fois (ou à chaque mise à jour officielle de la liste). Colle ce prompt
suivi de la liste officielle des items de la R2C (texte collé ou pièce jointe).

---

Tu vas transformer une liste officielle d'items de la Réforme du 2e cycle (R2C) que je te fournis
juste après ce message, en JSON d'import pour Studik, ma plateforme personnelle de révision.

## Consigne absolue

Ne rien ajouter qui ne soit pas dans le texte que je te fournis. Pas de reformulation de
l'intitulé, pas de complément de spécialité inventé, pas d'item ajouté qui ne figurerait pas dans
ma liste. Si une information demandée ci-dessous (ex. spécialités) n'est pas déductible du texte
fourni sans ambiguïté, laisse le champ correspondant à un tableau vide plutôt que de deviner.

## Schéma attendu (un tableau JSON, un objet par item)

- `numero` (nombre entier) : le numéro officiel de l'item.
- `intitule` (texte) : l'intitulé officiel exact, tel qu'écrit dans le texte source.
- `specialites` (tableau de texte) : la ou les spécialités associées si le texte source les donne
  explicitement (ex. rattachement à un collège) ; sinon `[]`.

Ne mets JAMAIS de champ `prioritaire` ni `notes` : ce sont des réglages personnels que je gère
moi-même dans l'interface après import, jamais déduits par toi.

## Format de sortie — non négociable

Réponds UNIQUEMENT avec le tableau JSON, sans phrase d'introduction, sans commentaire, sans
balises markdown (pas de ```). Je dois pouvoir coller ta réponse telle quelle dans `#import`
(cible "Items R2C").

## Exemple de sortie valide (structure à suivre EXACTEMENT, pas le contenu — ceci est fictif)

```
[
  { "numero": 1, "intitule": "La relation médecin-malade dans le cadre du colloque singulier ou au sein d'une équipe, le cas échéant pluriprofessionnelle", "specialites": ["Éthique"] },
  { "numero": 2, "intitule": "Les valeurs professionnelles du médecin et des autres professions de santé", "specialites": [] }
]
```
