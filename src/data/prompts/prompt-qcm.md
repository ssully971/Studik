# Prompt — QCM (Studik)

À REMPLIR AVANT D'ENVOYER :
- Titre du QCM : [TITRE]
- Matière(s) exacte(s), une ou plusieurs : [MATIÈRE 1, MATIÈRE 2...]
- Nombre de questions souhaité : [NOMBRE, ex. 20]
- Nombre d'items (propositions) par question, par défaut 5 : [NOMBRE ou "5 par défaut"]
- Durée en mode concours (minutes), par défaut 30 : [NOMBRE ou "30 par défaut"]
- Source jointe (cours sur lequel baser les questions) : [PDF / photo / texte collé / mes propres notes]

---

Tu es chargé de créer un QCM complet au format JSON, à partir du cours fourni, pour une plateforme personnelle de médecine.

RÈGLES DE FOND
- Base-toi en priorité sur le document ou le texte fourni pour construire des questions fidèles à ce qui y est enseigné.
- Chaque question comporte un énoncé et une liste d'items (propositions), chacun marqué vrai (`"correct": true`) ou faux (`"correct": false`).
- Les propositions fausses doivent être plausibles, pas des évidences faciles à écarter — ça doit être un vrai exercice de discrimination, comme un vrai QCM de concours.
- Varie le niveau de difficulté entre les questions du QCM (certaines plus simples, certaines plus pièges).
- Ajoute une explication courte (`"explication"`) à chaque item (chaque proposition), qui justifie pourquoi elle est vraie ou fausse — elle ne s'affiche que pour les items où l'utilisateur s'est trompé. Tu peux aussi garder une explication globale au niveau de la question (`"explication"` de la question) en complément, utilisée si un item n'a pas la sienne.
- Ajoute une explication courte (`"explication"`) pour chaque question, qui justifie la bonne réponse — elle s'affiche après correction.
- Si le cours ne permet pas de couvrir le nombre de questions demandé de façon fiable, fais-en moins plutôt que d'inventer du contenu non vérifiable, et signale-le à la fin de ta réponse (en dehors du JSON).
- Laisse `"fiches_liees"` vide (`[]`) — à remplir manuellement plus tard.

IDENTIFIANT
Construis "id" selon ce format : `qcm_prefixe-matiere_nom-court`
- minuscules uniquement, sans accents, mots séparés par des tirets
- exemple : `qcm_semio-cardio_douleur-thoracique`

FORMAT DE SORTIE ATTENDU (un tableau JSON contenant UN SEUL objet QCM) :

```
[
  {
    "id": "...",
    "titre": "[TITRE]",
    "matieres": ["[MATIÈRE 1]", "[MATIÈRE 2]"],
    "duree_minutes": 30,
    "fiches_liees": [],
    "statut": "valide",
    "questions": [
      {
        "enonce": "Énoncé de la question 1.",
        "items": [
          { "texte": "Proposition A", "correct": true, "explication": "Pourquoi A est vraie." },
          { "texte": "Proposition B", "correct": false, "explication": "Pourquoi B est fausse." },
          { "texte": "Proposition C", "correct": true, "explication": "Pourquoi C est vraie." },
          { "texte": "Proposition D", "correct": false, "explication": "Pourquoi D est fausse." },
          { "texte": "Proposition E", "correct": false, "explication": "Pourquoi E est fausse." }
        ],
        "explication": "Explication globale de la question, utilisée si un item n'a pas la sienne."
      }
    ]
  }
]
```

IMPORTANT — FORMAT DE RÉPONSE
Réponds UNIQUEMENT avec le JSON ci-dessus rempli, rien d'autre : pas de phrase d'introduction, pas de commentaire, pas de balises markdown (pas de ```). Je dois pouvoir copier ta réponse telle quelle dans le site. Si tu dois signaler que le cours ne couvre pas assez de matière pour le nombre de questions demandé, fais-le dans un message séparé, jamais à l'intérieur du JSON.
