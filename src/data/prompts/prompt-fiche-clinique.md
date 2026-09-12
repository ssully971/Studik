# Prompt — Fiche Clinique (Studik)

À REMPLIR AVANT D'ENVOYER :
- Matière exacte : [MATIÈRE]
- Tags autorisés (liste fermée, n'en utilise aucun autre) : [TAG1, TAG2, TAG3, ...]
- Source jointe : [PDF / photo / texte collé / mes propres notes]

---

Tu es chargé de transformer un extrait de cours de médecine en une fiche structurée au format JSON, pour un référentiel personnel de type "sémiologie" (signe/symptôme).

RÈGLES DE FOND
- Base-toi en priorité sur le document ou le texte fourni.
- Tu peux compléter avec tes connaissances médicales générales UNIQUEMENT si un point nécessaire à la compréhension manque dans la source. Dans ce cas, précise-le clairement dans le texte (ex. "(information non présente dans le cours, à vérifier)").
- N'invente aucune donnée chiffrée, aucune pathologie associée, aucun mécanisme que tu ne peux pas justifier.
- Si tu as un doute sérieux sur l'exactitude d'un point, mets `"statut": "brouillon"` et signale le doute dans le champ concerné.
- N'utilise que les tags listés ci-dessus, dans le champ "Tags autorisés". N'en invente aucun autre.
- Laisse les champs "pre_requis" et "consequences" vides (`[]`) — ils seront remplis manuellement plus tard.
- Ne remplis PAS "date_creation", "date_maj", "date_derniere_revision", "dernier_resultat" — ces champs sont gérés automatiquement par le site.

IDENTIFIANT
Construis "id" selon ce format : `prefixe-matiere_sous-categorie_nom-court`
- minuscules uniquement, sans accents
- mots séparés par des tirets `-`, sections séparées par underscore `_`
- exemple : `semio_cardio_dyspnee-effort`

FORMAT DE SORTIE ATTENDU (un tableau JSON contenant UN SEUL objet) :

```
[
  {
    "id": "...",
    "matiere": "[MATIÈRE]",
    "type": "clinique",
    "titre": "...",
    "synonymes": ["..."],
    "contenu_structure": {
      "description": "Description du signe/symptôme, en une ou deux phrases.",
      "contexte_recherche": [
        "Élément à rechercher à l'interrogatoire n°1",
        "Élément à rechercher à l'examen clinique n°1",
        "..."
      ]
    },
    "tags": ["..."],
    "pre_requis": [],
    "consequences": [],
    "pathologies_associees": ["Pathologie 1", "Pathologie 2", "..."],
    "statut": "valide",
    "source_cours": "Nom du cours / de l'UE, tel qu'indiqué sur le document"
  }
]
```

IMPORTANT — FORMAT DE RÉPONSE
Réponds UNIQUEMENT avec le JSON ci-dessus rempli, rien d'autre : pas de phrase d'introduction, pas de commentaire, pas de balises markdown (pas de ```). Je dois pouvoir copier ta réponse telle quelle dans le site.
