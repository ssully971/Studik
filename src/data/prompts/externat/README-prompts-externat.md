# Comment utiliser ces prompts (mode Externat)

## Fichiers
- `prompt-contexte-maitre-externat.md` — à coller AVANT chacun des prompts suivants (règles communes : fidélité à la source, `source: "genere"`, rang obligatoire, etc.)
- `prompt-r2c-items.md` / `prompt-r2c-sdd.md` — une seule fois (ou à chaque mise à jour), pour importer les listes officielles complètes des items R2C et des situations de départ
- `prompt-edn-qi.md` — questions isolées (QRU/QRM/QRP/QRP_LONG/QROC)
- `prompt-edn-zap.md` — question ZAP (énoncé seul, les zones se posent ensuite dans l'éditeur)
- `prompt-edn-dp.md` / `prompt-edn-kfp.md` / `prompt-edn-tcs.md` / `prompt-edn-lca.md` — dossiers complets avec leurs questions imbriquées
- `prompt-ecos-station.md` — station ECOS (import disponible dès maintenant, joueur au lot 5)
- `prompt-constantes-bio.md` — valeurs biologiques normales

## Workflow
1. Colle `prompt-contexte-maitre-externat.md`, puis le prompt spécifique à ce que tu veux créer, dans une conversation avec Claude, avec ta source (PDF/photo/texte du collège ou de la recommandation) en pièce jointe.
2. Copie la réponse (un JSON pur, sans ``` autour) directement dans `#import`, en sélectionnant la bonne cible (Items R2C / SDD / Dossiers EDN / Questions isolées / Stations ECOS / Constantes bio).

## À ne pas oublier
- Ce mode est entièrement séparé du référentiel P2 : aucune matière, aucun tag P2 n'est réutilisé ici — les questions/dossiers portent leurs propres champs `items`/`sdd`/`specialites` en texte libre.
- Le flag "prioritaire" d'un item R2C (page Items R2C) est personnel : aucun prompt ne le renseigne, tu le coches toi-même après import.
- Les zones ZAP sortent toujours vides (`zones: []`) : tu les poses toi-même dans l'éditeur `#edn-zap/:id` après avoir téléversé l'image.
