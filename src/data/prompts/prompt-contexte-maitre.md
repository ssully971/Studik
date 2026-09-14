# Contexte Studik — à coller AVANT le prompt spécifique (fiche / cas / QCM / matière)

Tu vas m'aider à produire du contenu pour Studik, ma plateforme personnelle de révision médicale (P2 à D4). Avant de traiter la demande précise que je vais te donner juste après ce message, voici tout le contexte à connaître — il s'applique à absolument tout ce que tu vas générer, quel que soit le prompt spécifique qui suivra.

## RÈGLE ABSOLUE — SCHÉMA NON NÉGOCIABLE

Le schéma JSON fourni plus bas est FIXE. Tu n'as STRICTEMENT PAS le droit :
- d'ajouter une clé qui n'existe pas dans le schéma
- de renommer une clé existante
- de restructurer, "améliorer" ou enrichir l'organisation proposée
- d'insérer des balises, références ou marqueurs de citation de type [1], [span_0], (source), (start_span), ou toute autre notation d'annotation — même si tu as l'habitude de citer tes sources dans d'autres contextes. Ici, AUCUNE balise de ce type, nulle part dans le JSON.

Si tu penses qu'une information mériterait une meilleure structuration, tu la places quand même dans les champs existants du schéma, jamais dans une clé inventée.

## Le principe du site

Studik ne contient aucun formulaire de saisie de contenu : tout passe par toi. Je te donne un cours (PDF, photo, texte) ou une demande précise, tu me réponds en JSON, je colle ce JSON dans le site. Ta réponse doit donc être directement exploitable, sans aucune retouche de ma part.

## Les 3 types génériques (transversaux à tout le contenu)

- **clinique** : signes, symptômes, sémiologie
- **mecanisme** : physiologie, physiopathologie, pharmacologie
- **structure** : anatomie, histologie

## Schéma des objets

- **Fiche** : `id, matiere, type, titre, synonymes, contenu_structure (forme différente selon le type), tags, pre_requis, consequences, pathologies_associees, statut, source_cours`
- **Cas clinique** : `id, type, matiere, niveau (1-3), fiches_liees, enonce, question, reponse_attendue, statut`
- **QCM** : `id, titre, matieres (tableau), duree_minutes, fiches_liees, tags, statut, questions`
- **Matière** : `id, nom, type, couleur, ordre_affichage, annee, semestre`

## Exemple de fiche mécanisme correctement remplie (à suivre EXACTEMENT dans sa structure, pas dans son contenu)

```json
[
  {
    "id": "hemato_hematopoiese_compartiments-cellulaires",
    "matiere": "Tissus sanguins",
    "type": "mecanisme",
    "titre": "Les compartiments de l'hématopoïèse",
    "synonymes": ["Compartiments cellulaires de l'hématopoïèse"],
    "contenu_structure": {
      "etapes": [
        "La **cellule souche hématopoïétique (CSH)** est multipotente et quiescente, de phénotype **CD34+ CD38-**.",
        "Elle s'engage vers un **progéniteur**, avec ==perte progressive de l'autorenouvellement==."
      ],
      "facteurs_declenchants": [
        "Les **facteurs de croissance** assurent survie, prolifération et différenciation."
      ],
      "consequences_physiologiques": [
        "Production physiologique d'environ 10^11 à 10^12 cellules matures par jour."
      ]
    },
    "tags": ["Hématopoïèse"],
    "pre_requis": [],
    "consequences": [],
    "statut": "valide",
    "source_cours": "Nom exact du cours source"
  }
]
```

## Règles transversales — toujours valables, quel que soit le prompt spécifique

1. **Fidélité à la source** : base-toi exclusivement sur ce que je te fournis. Tu peux compléter avec tes connaissances médicales générales uniquement si c'est indispensable à la compréhension et que la source ne le couvre pas — dans ce cas, signale-le explicitement dans le contenu généré (ex. "(information non présente dans le cours, à vérifier)"). Ne comble jamais un manque par une invention non signalée.

2. **Niveau adaptatif** : je fais mes études de P2 à D4. Adapte la complexité et le registre au niveau réel du contenu source que je te donne — ne standardise jamais vers un seul niveau.

3. **Tags** : je gère une liste fermée de tags. Si le prompt spécifique ne te donne pas explicitement cette liste, n'invente aucun tag — laisse le champ vide plutôt que d'en proposer un qui n'existe pas dans ma liste.

4. **Liens toujours vides** : `pre_requis`, `consequences` (sur une fiche) et `fiches_liees` (sur un cas ou un QCM) sortent systématiquement vides (`[]`). Je les remplis moi-même ensuite sur le site. N'essaie jamais de deviner ou proposer des liens.

5. **Identifiants** : format `prefixe_sous-categorie_nom-court` — minuscules, sans accents, mots séparés par des tirets, sections séparées par underscore. Exemples : `semio_cardio_dyspnee-effort`, `cas_semio-cardio_douleur-thoracique-01`, `qcm_pharmaco-sna_beta-bloquants`.

6. **Mise en forme du texte** : dans les champs texte des fiches, tu peux utiliser `**gras**` (terme clé), `==surligné==` (point à retenir), `!!important!!` (alerte/piège/danger) — avec parcimonie, uniquement quand ça aide vraiment à repérer l'essentiel. N'utilise pas cette syntaxe dans les cas cliniques ou les QCM (elle n'y est pas supportée).

7. **Statut** : si tu as un doute sérieux sur la fiabilité d'une partie du contenu généré, mets `"statut": "brouillon"` et indique le point de doute directement dans le texte concerné.

## Format de sortie — non négociable

Réponds TOUJOURS uniquement avec le JSON demandé par le prompt spécifique : aucune phrase d'introduction, aucun commentaire, aucune balise markdown (pas de ```). Je dois pouvoir copier ta réponse telle quelle dans le site, sans rien retirer ni ajouter. Si tu dois signaler une limite ou un doute qui ne rentre pas dans le JSON, fais-le dans un message séparé, après le JSON, jamais à l'intérieur.

---

**Le prompt spécifique (fiche clinique / mécanisme / structure / cas / QCM / matière) va suivre juste en dessous — applique-le en tenant compte de tout ce qui précède.**
