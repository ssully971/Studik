# Prompt — Questions isolées (QRU / QRM / QRP / QRP_LONG / QROC)

À utiliser pour générer des questions isolées (`dossier_id` null) à partir d'un chapitre de
collège. Précise-moi le **format demandé** avant de coller ce prompt (un seul format à la fois,
pour rester cohérent avec la source). TCS n'est pas ici : un TCS est toujours une question de
dossier (voir `prompt-edn-tcs.md`). ZAP a son propre prompt (`prompt-edn-zap.md`).

---

Génère des questions isolées au format **[QRU / QRM / QRP / QRP_LONG / QROC — choisis-en un]**, à
partir du texte que je fournis juste après ce message.

## Rappel des règles de notation propres au format choisi (ne pas les enfreindre)

- **QRU** : 4 à 5 propositions, une seule vraie ou indispensable parmi elles.
- **QRM** : 4 à 5 propositions, au moins une vraie. `indispensable` compte comme vrai (0 si non
  cochée), `inacceptable` compte comme faux (0 si cochée) — réserve ces deux statuts avec
  parcimonie, une majorité de `vrai`/`faux` suffit pour la plupart des questions.
- **QRP** : 4 à 5 propositions + un champ `n` (nombre de réponses attendues) qui doit être
  EXACTEMENT égal au nombre de propositions `vrai`/`indispensable`.
- **QRP_LONG** : 10 à 25 propositions, statuts `vrai`/`faux` UNIQUEMENT (jamais `indispensable` ni
  `inacceptable` sur ce format), + un champ `n` (1 à 5) égal au nombre de propositions `vrai`.
- **QROC** : réponse libre de 1 à 5 mots. `exactes` = la ou les formulations exactes attendues ;
  `acceptables` = formulations partielles ou synonymes qui valent la moitié des points.

## Schéma attendu (un tableau JSON, un objet par question)

- `id`, `rang` ("A" ou "B"), `items` (numéros R2C si la source les donne, sinon `[]`), `sdd`
  (idem), `specialites`, `enonce`, `contenu` (forme selon le format, voir ci-dessus), `explication`
  (globale, en plus de celle de chaque proposition), `source` ("genere"), `date_reference`, `tags`
  (`[]`, je les assigne moi-même).
- `image` : ne le mets QUE si la question a réellement besoin d'une image (dans ce cas laisse le
  champ absent : je l'ajoute moi-même après import via l'interface).

## Format de sortie — non négociable

Un tableau JSON brut, rien d'autre (pas de ```markdown```, pas de commentaire).

## Exemples de sortie valides (un par format — structure à suivre EXACTEMENT, contenu fictif)

```
[
  {
    "id": "qi_pneumo_pth-mecanisme-01",
    "format": "QRU",
    "rang": "A",
    "items": [],
    "sdd": [],
    "specialites": ["Pneumologie"],
    "enonce": "Concernant le pneumothorax spontané primitif, quelle proposition est exacte ?",
    "contenu": {
      "propositions": [
        { "id": "a", "texte": "Il survient typiquement chez un sujet jeune, longiligne, sans pathologie pulmonaire sous-jacente.", "statut": "vrai", "explication": "Terrain classique du pneumothorax spontané primitif." },
        { "id": "b", "texte": "Il est toujours secondaire à une BPCO évoluée.", "statut": "faux", "explication": "C'est le pneumothorax spontané SECONDAIRE qui est lié à une pathologie sous-jacente." },
        { "id": "c", "texte": "Il ne récidive jamais.", "statut": "faux", "explication": "Le risque de récidive homolatérale est au contraire élevé." },
        { "id": "d", "texte": "Il touche préférentiellement les sujets de plus de 60 ans.", "statut": "faux", "explication": "Terrain plus jeune, typiquement 20-40 ans." }
      ]
    },
    "explication": "Le pneumothorax spontané primitif touche un terrain particulier, à bien distinguer du secondaire.",
    "source": "genere",
    "date_reference": "2023",
    "tags": []
  },
  {
    "id": "qi_cardio_ecg-stemi-01",
    "format": "QRM",
    "rang": "A",
    "items": [],
    "sdd": [],
    "specialites": ["Cardiologie"],
    "enonce": "Parmi les propositions suivantes concernant le STEMI, lesquelles sont exactes ?",
    "contenu": {
      "propositions": [
        { "id": "a", "texte": "Un sus-décalage du segment ST dans au moins 2 dérivations contiguës est en faveur du diagnostic.", "statut": "indispensable", "explication": "Critère électrique central, à connaître impérativement." },
        { "id": "b", "texte": "La reperfusion doit être différée de 24h pour bilan complet.", "statut": "inacceptable", "explication": "Retarder la reperfusion met en jeu le pronostic vital — proposition dangereuse." },
        { "id": "c", "texte": "La troponine peut être normale dans les toutes premières heures.", "statut": "vrai", "explication": "La cinétique de la troponine s'élève progressivement." },
        { "id": "d", "texte": "Le diagnostic repose exclusivement sur la troponine.", "statut": "faux", "explication": "Le diagnostic est avant tout clinique et électrique." }
      ]
    },
    "explication": "Le STEMI est une urgence dont la reconnaissance rapide conditionne le pronostic.",
    "source": "genere",
    "date_reference": "2023",
    "tags": []
  },
  {
    "id": "qi_neuro_avc-signes-01",
    "format": "QRP",
    "rang": "B",
    "items": [],
    "sdd": [],
    "specialites": ["Neurologie"],
    "enonce": "Parmi les 5 propositions, coche les 3 signes évocateurs d'un AVC ischémique sylvien.",
    "contenu": {
      "n": 3,
      "propositions": [
        { "id": "a", "texte": "Hémiplégie brutale à prédominance brachio-faciale.", "statut": "indispensable", "explication": "Signe cardinal du territoire sylvien." },
        { "id": "b", "texte": "Céphalées en coup de tonnerre isolées.", "statut": "inacceptable", "explication": "Évoque plutôt une hémorragie méningée, pas un AVC sylvien typique." },
        { "id": "c", "texte": "Aphasie si hémisphère dominant.", "statut": "vrai", "explication": "Atteinte fréquente du territoire sylvien superficiel gauche." },
        { "id": "d", "texte": "Baisse d'acuité visuelle bilatérale progressive.", "statut": "faux", "explication": "Peu évocateur d'un AVC sylvien aigu." },
        { "id": "e", "texte": "Hémianopsie latérale homonyme.", "statut": "vrai", "explication": "Peut accompagner l'atteinte sylvienne profonde/postérieure." }
      ]
    },
    "explication": "Le syndrome sylvien associe classiquement déficit moteur, troubles du langage et parfois troubles du champ visuel.",
    "source": "genere",
    "date_reference": "2023",
    "tags": []
  },
  {
    "id": "qi_endocrino_diabete-complications-01",
    "format": "QRP_LONG",
    "rang": "B",
    "items": [],
    "sdd": [],
    "specialites": ["Endocrinologie"],
    "enonce": "Parmi la liste suivante, coche les 2 complications microvasculaires du diabète.",
    "contenu": {
      "n": 2,
      "propositions": [
        { "id": "a", "texte": "Rétinopathie diabétique", "statut": "vrai" },
        { "id": "b", "texte": "Néphropathie diabétique", "statut": "vrai" },
        { "id": "c", "texte": "Artériopathie oblitérante des membres inférieurs", "statut": "faux" },
        { "id": "d", "texte": "Infarctus du myocarde", "statut": "faux" },
        { "id": "e", "texte": "Accident vasculaire cérébral", "statut": "faux" },
        { "id": "f", "texte": "Cataracte précoce", "statut": "faux" },
        { "id": "g", "texte": "Pied diabétique par neuropathie", "statut": "faux" },
        { "id": "h", "texte": "Dysfonction érectile", "statut": "faux" },
        { "id": "i", "texte": "Gastroparésie", "statut": "faux" },
        { "id": "j", "texte": "Hypertension artérielle", "statut": "faux" }
      ]
    },
    "explication": "Rétinopathie et néphropathie sont les deux complications microvasculaires classiques à distinguer des complications macrovasculaires.",
    "source": "genere",
    "date_reference": "2023",
    "tags": []
  },
  {
    "id": "qi_orl_larynx-anatomie-01",
    "format": "QROC",
    "rang": "A",
    "items": [],
    "sdd": [],
    "specialites": ["ORL"],
    "enonce": "Quel est le nom de l'organe contenant les cordes vocales ?",
    "contenu": {
      "exactes": ["larynx"],
      "acceptables": []
    },
    "explication": "Le larynx abrite les cordes vocales et assure la phonation.",
    "source": "genere",
    "date_reference": "2023",
    "tags": []
  }
]
```
