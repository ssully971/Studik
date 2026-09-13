# Comment utiliser ces prompts

## Fichiers
- `prompt-matieres.md` — pour créer une ou plusieurs matières à partir d'une maquette/syllabus
- `prompt-fiche-clinique.md` — pour une fiche de type Clinique
- `prompt-fiche-mecanisme.md` — pour une fiche de type Mécanisme
- `prompt-fiche-structure.md` — pour une fiche de type Structure
- `prompt-cas.md` — pour un cas d'entraînement (les 3 types sont dans le même fichier)
- `prompt-qcm.md` — pour un QCM complet (plusieurs questions, mode entraînement ou concours)

## Workflow
1. Ouvre le fichier correspondant à ce que tu veux créer.
2. Remplis les champs entre crochets `[...]` en haut du prompt (matière, tags autorisés, type, année...).
3. Colle le prompt rempli dans une conversation avec Claude, avec ton PDF/photo/texte en pièce jointe.
4. Copie la réponse (un JSON pur, sans ``` autour) directement dans `#import` sur Studik, en sélectionnant le bon type (Fiches / Cas cliniques / Matières).

## À ne pas oublier
- Les `tags` doivent venir d'une liste fermée que tu choisis toi-même à chaque fois — décide-la avant d'envoyer le prompt pour rester cohérent dans tout le référentiel.
- `pre_requis`, `consequences`, et `fiches_liees` sortent toujours vides : c'est volontaire, tu les remplis toi-même ensuite sur le site.
- Si l'IA marque une fiche ou un cas en `"statut": "brouillon"`, c'est qu'elle a un doute — va vérifier avant de considérer l'info comme acquise.

## Reste à faire côté site (pas encore construit)
- Une page dédiée avec un bouton "copier" pour chaque prompt, pour ne plus avoir à rouvrir ces fichiers.
- Une interface simple pour ajouter des `pre_requis`/`consequences`/`fiches_liees` directement depuis le référentiel, sans réimporter du JSON.
- Le support de l'affichage des cas "mécanisme" et "structure" dans l'entraînement (actuellement seul le gabarit "clinique" est géré à l'écran).
