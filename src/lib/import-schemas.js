import { z } from 'zod'
import { GABARITS_CAS } from './cas.js'
import { idFieldPourCible } from './import-targets.js'

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

// ============================================================================
// Externat (§4, §5, §6) — schémas des cibles d'import propres au mode Externat. Les cibles
// P2 (fiches/cas/qcm) ci-dessus ne changent pas.
// ============================================================================

const SOURCES_EDN = ['annale', 'entrainement', 'genere']
const RANGS_EDN = ['A', 'B']
const FORMATS_QUESTION = ['QRU', 'QRM', 'QRP', 'QRP_LONG', 'QROC', 'ZAP', 'TCS']
const STATUTS_PROPOSITION = ['vrai', 'faux', 'indispensable', 'inacceptable']
const STATUTS_EDN = ['brouillon', 'valide', 'archive']

function compteCommeVrai(statut) {
  return statut === 'vrai' || statut === 'indispensable'
}

export function r2cItemSchema(nouveau) {
  return z.object({
    numero: z.number().int().positive(),
    intitule: champ(z.string().min(1), nouveau),
    specialites: z.array(z.string()).optional(),
    prioritaire: z.boolean().optional(),
    notes: z.string().nullable().optional(),
  })
}

export function r2cSddSchema(nouveau) {
  return z.object({
    numero: z.number().int().positive(),
    intitule: champ(z.string().min(1), nouveau),
    famille: z.string().nullable().optional(),
  })
}

function verifierPropositions(ctx, propositions, chemin, { statutsAutorises = STATUTS_PROPOSITION } = {}) {
  if (!Array.isArray(propositions)) {
    ctx.addIssue({ code: 'custom', path: chemin, message: 'tableau attendu' })
    return
  }
  propositions.forEach((p, i) => {
    const pChemin = [...chemin, i]
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      ctx.addIssue({ code: 'custom', path: pChemin, message: 'objet attendu' })
      return
    }
    verifierChampTexte(ctx, p.id, [...pChemin, 'id'], true)
    verifierChampTexte(ctx, p.texte, [...pChemin, 'texte'], true)
    if (!statutsAutorises.includes(p.statut)) {
      ctx.addIssue({ code: 'custom', path: [...pChemin, 'statut'], message: `valeur attendue parmi : ${statutsAutorises.join(', ')}` })
    }
  })
}

// Validation métier (§6) — nombre de propositions comptant comme vraies (vrai OU indispensable),
// à comparer selon le format : QRU = exactement 1, QRM = au moins 1, QRP/QRP_LONG = exactement n.
function compterVraies(propositions) {
  if (!Array.isArray(propositions)) return 0
  return propositions.filter((p) => p && compteCommeVrai(p.statut)).length
}

// Valide `contenu` selon le format (§5.1 à §5.8) — même principe que verifierContenuStructure :
// une seule source de vérité pour la forme attendue, partagée par le schéma d'import ET (au
// lot 3) par le moteur de rendu/notation.
function verifierContenuQuestion(ctx, format, contenu) {
  if (typeof contenu !== 'object' || contenu === null || Array.isArray(contenu)) return
  const base = ['contenu']

  if (format === 'QRU' || format === 'QRM' || format === 'QRP') {
    verifierPropositions(ctx, contenu.propositions, [...base, 'propositions'])
    if (Array.isArray(contenu.propositions) && (contenu.propositions.length < 4 || contenu.propositions.length > 5)) {
      ctx.addIssue({ code: 'custom', path: [...base, 'propositions'], message: 'entre 4 et 5 propositions' })
    }
    if (format === 'QRP') {
      if (!Number.isInteger(contenu.n) || contenu.n < 1) {
        ctx.addIssue({ code: 'custom', path: [...base, 'n'], message: 'nombre entier ≥ 1 attendu' })
      } else if (Array.isArray(contenu.propositions) && compterVraies(contenu.propositions) !== contenu.n) {
        ctx.addIssue({ code: 'custom', path: [...base, 'n'], message: `doit correspondre au nombre de propositions vraies/indispensables cochées (${contenu.n} attendu)` })
      }
    } else if (format === 'QRU') {
      if (Array.isArray(contenu.propositions) && compterVraies(contenu.propositions) !== 1) {
        ctx.addIssue({ code: 'custom', path: [...base, 'propositions'], message: 'exactement 1 proposition vraie ou indispensable' })
      }
    } else if (format === 'QRM') {
      if (Array.isArray(contenu.propositions) && compterVraies(contenu.propositions) < 1) {
        ctx.addIssue({ code: 'custom', path: [...base, 'propositions'], message: 'au moins 1 proposition vraie' })
      }
    }
  } else if (format === 'QRP_LONG') {
    verifierPropositions(ctx, contenu.propositions, [...base, 'propositions'], { statutsAutorises: ['vrai', 'faux'] })
    if (Array.isArray(contenu.propositions) && (contenu.propositions.length < 10 || contenu.propositions.length > 25)) {
      ctx.addIssue({ code: 'custom', path: [...base, 'propositions'], message: 'entre 10 et 25 propositions' })
    }
    if (!Number.isInteger(contenu.n) || contenu.n < 1 || contenu.n > 5) {
      ctx.addIssue({ code: 'custom', path: [...base, 'n'], message: 'nombre entier entre 1 et 5 attendu' })
    } else if (Array.isArray(contenu.propositions) && compterVraies(contenu.propositions) !== contenu.n) {
      ctx.addIssue({ code: 'custom', path: [...base, 'n'], message: `doit correspondre au nombre de propositions vraies cochées (${contenu.n} attendu)` })
    }
  } else if (format === 'ZAP') {
    if (!Number.isInteger(contenu.x) || contenu.x < 1 || contenu.x > 5) {
      ctx.addIssue({ code: 'custom', path: [...base, 'x'], message: 'nombre entier entre 1 et 5 attendu' })
    }
    if (contenu.zones !== undefined && !Array.isArray(contenu.zones)) {
      ctx.addIssue({ code: 'custom', path: [...base, 'zones'], message: 'tableau attendu' })
    } else if (Array.isArray(contenu.zones)) {
      contenu.zones.forEach((z, i) => {
        const zChemin = [...base, 'zones', i]
        if (typeof z !== 'object' || z === null) {
          ctx.addIssue({ code: 'custom', path: zChemin, message: 'objet attendu' })
          return
        }
        verifierChampTexte(ctx, z.id, [...zChemin, 'id'], true)
        if (!['cercle', 'rect'].includes(z.forme)) {
          ctx.addIssue({ code: 'custom', path: [...zChemin, 'forme'], message: 'valeur attendue parmi : cercle, rect' })
        }
      })
    }
  } else if (format === 'QROC') {
    verifierTableauTexte(ctx, contenu.exactes, [...base, 'exactes'], true)
    verifierTableauTexte(ctx, contenu.acceptables, [...base, 'acceptables'], false)
  } else if (format === 'TCS') {
    verifierChampTexte(ctx, contenu.hypothese, [...base, 'hypothese'], true)
    verifierChampTexte(ctx, contenu.information, [...base, 'information'], true)
    const CLES_VOTES = ['-2', '-1', '0', '1', '2']
    const votes = contenu.votes
    if (typeof votes !== 'object' || votes === null || Array.isArray(votes)) {
      ctx.addIssue({ code: 'custom', path: [...base, 'votes'], message: 'objet attendu' })
    } else {
      const manquantes = CLES_VOTES.filter((cle) => typeof votes[cle] !== 'number')
      if (manquantes.length > 0) {
        ctx.addIssue({ code: 'custom', path: [...base, 'votes'], message: `les 5 clés de vote sont attendues (manquante(s) : ${manquantes.join(', ')})` })
      } else if (CLES_VOTES.every((cle) => votes[cle] === 0)) {
        ctx.addIssue({ code: 'custom', path: [...base, 'votes'], message: 'au moins un vote non nul attendu' })
      }
    }
    if (contenu.panel !== undefined && !['simule', 'reel'].includes(contenu.panel)) {
      ctx.addIssue({ code: 'custom', path: [...base, 'panel'], message: 'valeur attendue parmi : simule, reel' })
    }
  }
}

// Question EDN — isolée (dossier_id absent du JSON, ajouté par lib/edn-content.js) ou imbriquée
// dans un dossier. `ordre` n'est significatif que dans le cas imbriqué.
export function ednQuestionSchema(nouveau) {
  return z
    .object({
      id: z.string().min(1),
      ordre: z.number().int().nullable().optional(),
      format: champ(z.enum(FORMATS_QUESTION), nouveau),
      rang: champ(z.enum(RANGS_EDN), nouveau),
      items: z.array(z.number().int()).optional(),
      sdd: z.array(z.number().int()).optional(),
      specialites: z.array(z.string()).optional(),
      enonce: champ(z.string().min(1), nouveau),
      image: z.string().nullable().optional(),
      contenu: champ(z.record(z.string(), z.any()), nouveau),
      explication: z.string().nullable().optional(),
      source: champ(z.enum(SOURCES_EDN), nouveau),
      date_reference: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      statut: z.enum(STATUTS_EDN).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.format && data.contenu !== undefined) verifierContenuQuestion(ctx, data.format, data.contenu)
    })
}

function verifierOrdresUniques(ctx, questions) {
  const vus = new Map()
  questions.forEach((q, i) => {
    if (q.ordre === undefined || q.ordre === null) return
    if (vus.has(q.ordre)) {
      ctx.addIssue({ code: 'custom', path: ['questions', i, 'ordre'], message: `ordre en doublon avec la question n°${vus.get(q.ordre) + 1}` })
    } else {
      vus.set(q.ordre, i)
    }
  })
}

export function ednDossierSchema(nouveau) {
  return z
    .object({
      id: z.string().min(1),
      type: champ(z.enum(['DP', 'KFP', 'TCS', 'LCA']), nouveau),
      titre: champ(z.string().min(1), nouveau),
      sdd: z.array(z.number().int()).optional(),
      items: z.array(z.number().int()).optional(),
      specialites: z.array(z.string()).optional(),
      vignette: z.string().nullable().optional(),
      article_url: z.string().nullable().optional(),
      source: champ(z.enum(SOURCES_EDN), nouveau),
      date_reference: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      statut: z.enum(STATUTS_EDN).optional(),
      questions: z.array(ednQuestionSchema(true)).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.questions) verifierOrdresUniques(ctx, data.questions)
    })
}

export function ecosStationSchema(nouveau) {
  return z.object({
    id: z.string().min(1),
    titre: champ(z.string().min(1), nouveau),
    sdd: z.array(z.number().int()).optional(),
    domaine: champ(z.string().min(1), nouveau),
    interlocuteur: champ(z.enum(['PS', 'PSS', 'aucun']), nouveau),
    vignette: z.string().nullable().optional(),
    consignes_examinateur: z.string().nullable().optional(),
    script_interlocuteur: z.string().nullable().optional(),
    documents: z.array(z.record(z.string(), z.any())).optional(),
    grille: champ(
      z.object({
        items: z
          .array(
            z.object({
              id: z.string().min(1),
              critere: z.string().min(1),
              points: z.number(),
              critique: z.boolean().optional(),
            })
          )
          .min(1),
        global: z.boolean().optional(),
      }),
      nouveau
    ),
    source: champ(z.enum(SOURCES_EDN), nouveau),
    tags: z.array(z.string()).optional(),
    statut: z.enum(STATUTS_EDN).optional(),
  })
}

export function constanteBioSchema(nouveau) {
  return z.object({
    id: z.string().min(1),
    categorie: champ(z.string().min(1), nouveau),
    parametre: champ(z.string().min(1), nouveau),
    valeur_normale: champ(z.string().min(1), nouveau),
    unite: z.string().nullable().optional(),
    ordre: z.number().int().optional(),
  })
}

const SCHEMA_PAR_CIBLE = {
  fiches: ficheSchema,
  cas: casSchema,
  qcm: qcmSchema,
  r2c_items: r2cItemSchema,
  r2c_sdd: r2cSddSchema,
  edn_dossiers: ednDossierSchema,
  edn_questions: ednQuestionSchema,
  ecos_stations: ecosStationSchema,
  constantes_bio: constanteBioSchema,
}
const LABEL_PAR_CIBLE = {
  fiches: 'Fiche',
  cas: 'Cas',
  qcm: 'QCM',
  r2c_items: 'Item R2C',
  r2c_sdd: 'SDD',
  edn_dossiers: 'Dossier',
  edn_questions: 'Question',
  ecos_stations: 'Station ECOS',
  constantes_bio: 'Constante',
}

// Réexporté pour compatibilité (voir lib/import-targets.js pour la raison de la séparation :
// pages/import.js a besoin de cette fonction sans charger zod).
export { idFieldPourCible }

// Valide tout le lot importé. Tout-ou-rien : si un seul élément échoue, aucun n'est inséré
// (voir pages/import.js, appelé avant tout effet de bord). L'insertion elle-même (upsertPartiel,
// séquentielle et non atomique) n'est pas modifiée par cette validation.
export function validerImport(target, items, existingIds) {
  const existingSet = existingIds instanceof Set ? existingIds : new Set(existingIds)
  const construireSchema = SCHEMA_PAR_CIBLE[target]
  const label = LABEL_PAR_CIBLE[target]
  const idField = idFieldPourCible(target)
  const erreurs = []

  items.forEach((item, index) => {
    const nouveau = !existingSet.has(item[idField])
    const resultat = construireSchema(nouveau).safeParse(item)
    if (!resultat.success) {
      resultat.error.issues.forEach((issue) => erreurs.push(formaterErreur(label, index, issue)))
    }
  })

  return erreurs
}
