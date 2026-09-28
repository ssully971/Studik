# Contexte Externat — à coller AVANT les prompts de contenu (questions/dossiers/ECOS/constantes)

Tu vas m'aider à produire du contenu de préparation à l'EDN (Épreuves Dématérialisées Nationales,
R2C) pour Studik, ma plateforme personnelle de révision. Avant de traiter la demande précise qui
va suivre, voici le contexte qui s'applique à tout ce que tu vas générer dans ce mode.

## RÈGLE ABSOLUE — SCHÉMA NON NÉGOCIABLE

Le schéma JSON fourni dans le prompt spécifique est FIXE. Tu n'as STRICTEMENT PAS le droit
d'ajouter une clé qui n'existe pas, d'en renommer une, ou d'insérer des balises de citation
([1], (source), etc.). Aucune exception.

## Règles communes à tout le contenu Externat (§6 du cahier des charges)

1. **Fidélité stricte à la source.** Tu génères EXCLUSIVEMENT à partir du texte que je te fournis
   (chapitre de collège, référentiel, recommandation officielle). Interdiction absolue d'inventer
   une recommandation, un chiffre, une valeur seuil ou un item qui ne figure pas dans la source.
2. **`source` vaut toujours `"genere"`** pour du contenu que tu produis (jamais `"annale"`, réservé
   aux vraies annales officielles que je saisirais moi-même).
3. **`date_reference`** = l'année de l'édition du collège ou de la recommandation citée dans ta
   source, `null` si elle n'est pas indiquée. Ne devine jamais une année.
4. **`rang`** (A ou B) est obligatoire sur chaque question : les collèges marquent explicitement le
   rang de chaque connaissance. Reporte-le tel quel, ne le déduis jamais d'autre chose.
5. **`items`/`sdd`** (numéros R2C) : ne les renseigne QUE si la source les indique explicitement.
   Sinon, laisse les tableaux vides — je les complète moi-même après import.
6. **Distracteurs plausibles.** Les propositions fausses doivent être médicalement crédibles, pas
   des absurdités faciles à repérer.
7. **`inacceptable` réservé au danger réel.** N'utilise ce statut que pour une proposition dont le
   choix serait dangereux pour un patient réel (ex. contre-indication formelle, geste délétère) —
   jamais pour une simple erreur de connaissance.
8. **Explication systématique.** Chaque proposition a son `explication` (pourquoi elle est vraie,
   fausse, indispensable ou inacceptable), sourcée sur le texte fourni.
9. **Mélange non géré par toi.** Ne trie jamais les propositions par ordre de "bonne réponse en
   premier" ni autrement : le site mélange lui-même à l'affichage (Fisher-Yates). Écris-les dans
   l'ordre qui te semble le plus naturel pour la relecture.
10. **Format de sortie non négociable.** Réponds UNIQUEMENT avec le JSON demandé par le prompt
    spécifique : aucune phrase d'introduction, aucun commentaire, aucune balise markdown (pas de
    ```). Si tu as un doute sérieux sur une partie du contenu, mets `"statut": "brouillon"` et
    indique le doute directement dans le texte concerné (jamais en dehors du JSON).

## Identifiants

Même format que le reste de Studik : minuscules, sans accents, mots séparés par des tirets,
sections séparées par underscore. Exemples : `dp_cardio_douleur-thoracique-01`,
`qi_pneumo_pneumothorax-spontane`, `ecos_annonce_cancer-bronchique`.

---

**Le prompt spécifique (questions isolées / DP / KFP / TCS / LCA / ZAP / station ECOS /
constantes biologiques) va suivre juste en dessous — applique-le en tenant compte de tout ce qui
précède.**
