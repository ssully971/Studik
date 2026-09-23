import { z } from 'zod'
import { GABARITS_CAS } from './cas.js'

// Chargé par import dynamique depuis pages/import.js (au clic sur "Importer") pour ne pas
// alourdir le bundle principal avec zod.
//
// Sources de vérité croisées pour ces schémas : src/data/prompts/*.md (le format que Claude
// produit) ET l'usage réel du code (quels champs sont lus, où, avec quelle forme). Écarts
// trouvés entre les deux, non tranchés ici :
// - prompt-matieres.md existe mais #import n'a aucune cible "matières" (seulement
//   fiches/cas/qcm) : ce prompt n'est donc pas branché sur une validation ici.
// - pathologies_associees n'apparaît que dans prompt-fiche-clinique.md, mais le code
//   (fiche-detail.js) l'affiche pour tous les types sans distinction : traité ici comme
//   optionnel pour les 3 types plutôt que refusé pour mecanisme/structure.
// - q.image (image d'une question QCM) n'est produit par aucun prompt (ajouté après coup via
//   l'upload dans #qcm/:id) : accepté en optionnel plutôt que jamais autorisé.

const TYPES_CONTENU = ['clinique', 'mecanisme', 'structure']
const STATUTS_FICHE = ['brouillon', 'valide', 'a_revoir', 'archive']
const STATUTS_CAS_QCM = ['brouillon', 'valide', 'archive']

const LIBELLES_TYPE = {
  string: 'texte',
  number: 'nombre',
  boolean: 'booléen',
  array: 'tableau',
  object: 'objet',
  record: 'objet',
}

// Convertit un ZodIssue en message court en français. Ne dépend pas du texte des messages
// natifs de zod (qui changent d'une version à l'autre) : seulement des codes et métadonnées
// stables de l'issue.
function messageDepuisIssue(issue) {
  switch (issue.code) {
    case 'invalid_type':
      return `${LIBELLES_TYPE[issue.expected] || issue.expected} attendu`
    case 'too_small':
      if (issue.origin === 'string') return 'obligatoire'
      if (issue.origin === 'array') return `au moins ${issue.minimum} élément${issue.minimum > 1 ? 's' : ''}`
      if (issue.origin === 'number') return `doit être ≥ ${issue.minimum}`
      return issue.message
    case 'too_big':
      if (issue.origin === 'number') return `doit être ≤ ${issue.maximum}`
      if (issue.origin === 'array') return `au plus ${issue.maximum} éléments`
      return issue.message
    case 'invalid_value':
      return `valeur attendue parmi : ${(issue.values || []).join(', ')}`
    case 'custom':
      return issue.message
    default:
      return issue.message
  }
}

// ["questions", 6, "items", 2, "correct"] -> "questions › 7 › items › 3 › correct" (index
// techniques 0-based convertis en position 1-based, lisible par un humain).
function cheminLisible(path) {
  return path.map((seg) => (typeof seg === 'number' ? seg + 1 : seg)).join(' › ')
}

// Ex. "QCM n°1 › questions › 7 › items › 3 › correct : booléen attendu"
function formaterErreur(label, index, issue) {
  const chemin = cheminLisible(issue.path)
  return `${label} n°${index + 1}${chemin ? ' › ' + chemin : ''} : ${messageDepuisIssue(issue)}`
}

function champ(schema, requis) {
  return requis ? schema : schema.optional()
}

function verifierChampTexte(ctx, valeur, chemin, requis) {
  if (valeur === undefined || valeur === null) {
    if (requis) ctx.addIssue({ code: 'custom', path: chemin, message: 'texte attendu' })
    return
  }
  if (typeof valeur !== 'string') {
    ctx.addIssue({ code: 'custom', path: chemin, message: 'texte attendu' })
  } else if (requis && valeur.trim() === '') {
    ctx.addIssue({ code: 'custom', path: chemin, message: 'obligatoire' })
  }
}

function verifierTableauTexte(ctx, valeur, chemin, requis) {
  if (valeur === undefined || valeur === null) {
    if (requis) ctx.addIssue({ code: 'custom', path: chemin, message: 'tableau attendu' })
    return
  }
  if (!Array.isArray(valeur)) {
    ctx.addIssue({ code: 'custom', path: chemin, message: 'tableau attendu' })
    return
  }
  if (requis && valeur.length === 0) {
    ctx.addIssue({ code: 'custom', path: chemin, message: 'au moins 1 élément' })
  }
  valeur.forEach((v, i) => {
    if (typeof v !== 'string') ctx.addIssue({ code: 'custom', path: [...chemin, i], message: 'texte attendu' })
  })
}

// Forme de contenu_structure selon le type de fiche — voir src/data/prompts/prompt-fiche-*.md
// (FORMAT DE SORTIE ATTENDU). Les listes secondaires restent optionnelles (une fiche peut
// légitimement ne pas avoir de facteur déclenchant à lister, par exemple) ; seuls les champs
// qui portent le contenu central du type sont obligatoires.
function verifierContenuStructure(ctx, type, contenu) {
  if (typeof contenu !== 'object' || contenu === null || Array.isArray(contenu)) return // déjà signalé (objet attendu)
  const base = ['contenu_structure']
  if (type === 'clinique') {
    verifierChampTexte(ctx, contenu.description, [...base, 'description'], true)
    verifierTableauTexte(ctx, contenu.contexte_recherche, [...base, 'contexte_recherche'], false)
  } else if (type === 'mecanisme') {
    verifierTableauTexte(ctx, contenu.etapes, [...base, 'etapes'], true)
    verifierTableauTexte(ctx, contenu.facteurs_declenchants, [...base, 'facteurs_declenchants'], false)
    verifierTableauTexte(ctx, contenu.consequences_physiologiques, [...base, 'consequences_physiologiques'], false)
  } else if (type === 'structure') {
    verifierChampTexte(ctx, contenu.localisation, [...base, 'localisation'], true)
    verifierTableauTexte(ctx, contenu.rapports_anatomiques, [...base, 'rapports_anatomiques'], false)
    verifierChampTexte(ctx, contenu.fonction, [...base, 'fonction'], true)
  }
}

// Forme de reponse_attendue selon le gabarit du type de cas — GABARITS_CAS est la même source
// que celle utilisée pour l'affichage (lib/cas.js), donc jamais de divergence possible entre
// validation et rendu.
function verifierReponseAttendue(ctx, type, reponse) {
  if (typeof reponse !== 'object' || reponse === null || Array.isArray(reponse)) return // déjà signalé (objet attendu)
  const gabarit = GABARITS_CAS[type]
  if (!gabarit) return // type invalide déjà signalé par ailleurs

  const base = ['reponse_attendue']
  const items = reponse[gabarit.itemsKey]
  if (items === undefined || items === null) {
    ctx.addIssue({ code: 'custom', path: [...base, gabarit.itemsKey], message: 'tableau attendu' })
  } else if (!Array.isArray(items)) {
    ctx.addIssue({ code: 'custom', path: [...base, gabarit.itemsKey], message: 'tableau attendu' })
  } else {
    if (items.length === 0) ctx.addIssue({ code: 'custom', path: [...base, gabarit.itemsKey], message: 'au moins 1 élément' })
    items.forEach((item, i) => {
      const p = [...base, gabarit.itemsKey, i]
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        ctx.addIssue({ code: 'custom', path: p, message: 'objet attendu' })
        return
      }
      verifierChampTexte(ctx, item.label, [...p, 'label'], true)
      if (typeof item.correct !== 'boolean') ctx.addIssue({ code: 'custom', path: [...p, 'correct'], message: 'booléen attendu' })
    })
  }

  verifierTableauTexte(ctx, reponse[gabarit.resultKey], [...base, gabarit.resultKey], false)
}

// `nouveau` = true : schéma complet (id inédit, tous les champs obligatoires validés).
// `nouveau` = false : mise à jour partielle (id déjà existant, via upsertPartiel) — tous les
// champs sont optionnels, mais validés s'ils sont présents.

export function ficheSchema(nouveau) {
  return z
    .object({
      id: z.string().min(1),
      matiere: champ(z.string().min(1), nouveau),
      sous_matiere: z.string().nullable().optional(),
      cours: z.string().nullable().optional(),
      type: champ(z.enum(TYPES_CONTENU), nouveau),
      titre: champ(z.string().min(1), nouveau),
      synonymes: z.array(z.string()).optional(),
      contenu_structure: champ(z.record(z.string(), z.any()), nouveau),
      tags: z.array(z.string()).optional(),
      pre_requis: z.array(z.string()).optional(),
      consequences: z.array(z.string()).optional(),
      pathologies_associees: z.array(z.string()).optional(),
      statut: z.enum(STATUTS_FICHE).optional(),
      notes_perso: z.string().nullable().optional(),
      source_cours: z.string().nullable().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type && data.contenu_structure !== undefined) {
        verifierContenuStructure(ctx, data.type, data.contenu_structure)
      }
    })
}

export function casSchema(nouveau) {
  return z
    .object({
      id: z.string().min(1),
      type: champ(z.enum(TYPES_CONTENU), nouveau),
      matiere: champ(z.string().min(1), nouveau),
      cours: z.string().nullable().optional(),
      niveau: champ(z.number().int().min(1).max(3), nouveau),
      fiches_liees: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      enonce: champ(
        z.object({
          situation: z.string().min(1),
          elements: z.array(z.string()).optional(),
        }),
        nouveau
      ),
      question: champ(z.string().min(1), nouveau),
      reponse_attendue: champ(z.record(z.string(), z.any()), nouveau),
      statut: z.enum(STATUTS_CAS_QCM).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type && data.reponse_attendue !== undefined) {
        verifierReponseAttendue(ctx, data.type, data.reponse_attendue)
      }
    })
}

const itemQcmSchema = z.object({
  texte: z.string().min(1),
  correct: z.boolean(),
  explication: z.string().optional(),
})

const questionQcmSchema = z.object({
  enonce: z.string().min(1),
  items: z.array(itemQcmSchema).min(2),
  explication: z.string().optional(),
  image: z.string().optional(),
})

export function qcmSchema(nouveau) {
  return z.object({
    id: z.string().min(1),
    titre: champ(z.string().min(1), nouveau),
    matieres: z.array(z.string()).optional(),
    cours: z.string().nullable().optional(),
    duree_minutes: champ(z.number().int().positive(), nouveau),
    fiches_liees: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    statut: z.enum(STATUTS_CAS_QCM).optional(),
    questions: champ(z.array(questionQcmSchema).min(1), nouveau),
  })
}

const SCHEMA_PAR_CIBLE = { fiches: ficheSchema, cas: casSchema, qcm: qcmSchema }
const LABEL_PAR_CIBLE = { fiches: 'Fiche', cas: 'Cas', qcm: 'QCM' }

// Valide tout le lot importé. Tout-ou-rien : si un seul élément échoue, aucun n'est inséré
// (voir pages/import.js, appelé avant tout effet de bord). L'insertion elle-même (upsertPartiel,
// séquentielle et non atomique) n'est pas modifiée par cette validation.
export function validerImport(target, items, existingIds) {
  const existingSet = existingIds instanceof Set ? existingIds : new Set(existingIds)
  const construireSchema = SCHEMA_PAR_CIBLE[target]
  const label = LABEL_PAR_CIBLE[target]
  const erreurs = []

  items.forEach((item, index) => {
    const nouveau = !existingSet.has(item.id)
    const resultat = construireSchema(nouveau).safeParse(item)
    if (!resultat.success) {
      resultat.error.issues.forEach((issue) => erreurs.push(formaterErreur(label, index, issue)))
    }
  })

  return erreurs
}
