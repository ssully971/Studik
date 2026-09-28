# Prompt — Situations de départ (SDD)

À utiliser une seule fois (ou à chaque mise à jour officielle de la liste). Colle ce prompt suivi
de la liste officielle des 356 situations de départ (texte collé ou pièce jointe).

---

Tu vas transformer une liste officielle de situations de départ (SDD) que je te fournis juste
après ce message, en JSON d'import pour Studik, ma plateforme personnelle de révision.

## Consigne absolue

Ne rien ajouter qui ne soit pas dans le texte que je te fournis. Pas de reformulation de
l'intitulé, pas de famille inventée si le texte source ne classe pas explicitement les situations
par famille.

## Schéma attendu (un tableau JSON, un objet par situation)

- `numero` (nombre entier) : le numéro officiel de la situation de départ.
- `intitule` (texte) : l'intitulé officiel exact, tel qu'écrit dans le texte source.
- `famille` (texte ou `null`) : la famille/le regroupement thématique si le texte source le donne
  explicitement ; `null` sinon.

## Format de sortie — non négociable

Réponds UNIQUEMENT avec le tableau JSON, sans phrase d'introduction, sans commentaire, sans
balises markdown (pas de ```). Je dois pouvoir coller ta réponse telle quelle dans `#import`
(cible "SDD").

## Exemple de sortie valide (structure à suivre EXACTEMENT, pas le contenu — ceci est fictif)

```
[
  { "numero": 1, "intitule": "Agitation", "famille": "Situations neuropsychiatriques" },
  { "numero": 2, "intitule": "Alcoolémie / Alcoolurie : demande d'examen", "famille": null }
]
```
