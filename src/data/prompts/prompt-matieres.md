# Prompt — Matières (Studik)

À REMPLIR AVANT D'ENVOYER :
- Année (ex. "P2", "D2") : [ANNÉE]
- Source jointe (maquette, syllabus, sommaire de cours) : [PDF / photo / texte collé]

---

Tu es chargé d'extraire la liste des matières/UE d'un document (maquette de scolarité, syllabus, sommaire) pour créer des entrées structurées au format JSON.

RÈGLES DE FOND
- Une matière = une UE ou une sous-partie clairement identifiée dans le document (ex. "Sémiologie", "Anatomie", "Pharmacologie").
- Classe chaque matière dans l'un des 3 types suivants, selon sa nature :
  - "clinique" : sémiologie, matières centrées sur les signes/symptômes
  - "mecanisme" : pharmacologie, physiologie, biochimie, bases moléculaires/cellulaires
  - "structure" : anatomie, histologie
  - Si une matière ne correspond clairement à aucun des trois, choisis celui qui s'en rapproche le plus et signale ton choix par un commentaire dans le champ "nom" entre parenthèses.
- Récupère l'année et le semestre depuis le document si c'est indiqué (ex. "Semestre 1", "S1"). Si l'information n'est pas présente, laisse `"semestre": null`.
- Laisse `"couleur": null` et `"ordre_affichage": 0` — tu peux affiner l'ordre uniquement s'il est explicitement numéroté dans le document (ex. "UE1", "UE2"), sinon laisse 0 partout.
- Ne crée pas de doublons : si deux lignes du document désignent la même matière, n'en fais qu'une entrée.

IDENTIFIANT
Construis "id" à partir du nom, en minuscules, sans accents, mots séparés par des tirets.
Exemple : "Sémiologie générale" → `semiologie-generale`

FORMAT DE SORTIE ATTENDU (un tableau JSON, une entrée par matière trouvée) :

```
[
  {
    "id": "...",
    "nom": "...",
    "type": "clinique",
    "couleur": null,
    "ordre_affichage": 0,
    "annee": "[ANNÉE]",
    "semestre": "..."
  }
]
```

IMPORTANT — FORMAT DE RÉPONSE
Réponds UNIQUEMENT avec le JSON ci-dessus rempli, rien d'autre : pas de phrase d'introduction, pas de commentaire, pas de balises markdown (pas de ```). Je dois pouvoir copier ta réponse telle quelle dans le site.
