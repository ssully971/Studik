import { supabase } from './supabase.js'
import { lirePreference, ecrirePreference } from './preferences.js'
import { getCiblesDues } from './edn-srs-data.js'
import { getNumerosPrioritaires } from './r2c.js'
import { selectionnerCiblesDues } from './edn-srs.js'
import { melangerFisherYates } from './edn-shuffle.js'
import { paginerTout, requeteParLots } from './supabase-paginate.js'

const PLAFOND_PAR_DEFAUT = 100

export async function getPlafondRevisions() {
  try {
    const v = await lirePreference('edn_plafond_revisions')
    return typeof v === 'number' && v > 0 ? v : PLAFOND_PAR_DEFAUT
  } catch {
    return PLAFOND_PAR_DEFAUT
  }
}

export async function setPlafondRevisions(n) {
  await ecrirePreference('edn_plafond_revisions', n)
}

// Enrichit les cibles dues brutes (edn_srs) avec leur caractère "prioritaire" (dérivé des items
// R2C liés à la question/au dossier), puis applique le plafond anti-surcharge (§7.1).
export async function getCiblesDuesTriees(plafond) {
  const cibles = await getCiblesDues()
  if (cibles.length === 0) return []

  const idsQuestions = cibles.filter((c) => c.cible.startsWith('q:')).map((c) => c.cible.slice(2))
  const idsDossiers = cibles.filter((c) => c.cible.startsWith('d:')).map((c) => c.cible.slice(2))

  const [questions, dossiers, prioritaires] = await Promise.all([
    requeteParLots(idsQuestions, (lot) => supabase.from('edn_questions').select('id, items').in('id', lot)),
    requeteParLots(idsDossiers, (lot) => supabase.from('edn_dossiers').select('id, items').in('id', lot)),
    getNumerosPrioritaires(),
  ])

  const itemsParCible = {}
  questions.forEach((q) => {
    itemsParCible[`q:${q.id}`] = q.items || []
  })
  dossiers.forEach((d) => {
    itemsParCible[`d:${d.id}`] = d.items || []
  })

  const enrichies = cibles.map((c) => ({
    cible: c.cible,
    prochaineRevision: c.prochaine_revision,
    prioritaire: (itemsParCible[c.cible] || []).some((n) => prioritaires.has(n)),
  }))

  return selectionnerCiblesDues(enrichies, plafond)
}

// Série Flash (§7.2) : 5 cibles dues en priorisant les questions isolées (plus courtes), sinon 5
// questions isolées au hasard parmi celles déjà tentées.
export async function getCiblesFlash() {
  const dues = await getCiblesDuesTriees(9999)
  if (dues.length > 0) {
    const questions = dues.filter((c) => c.cible.startsWith('q:'))
    const dossiers = dues.filter((c) => c.cible.startsWith('d:'))
    return [...questions, ...dossiers].slice(0, 5)
  }

  const data = await paginerTout(() => supabase.from('edn_tentatives').select('cible').like('cible', 'q:%').order('id'))
  const cibleUniques = Array.from(new Set(data.map((t) => t.cible)))
  return melangerFisherYates(cibleUniques)
    .slice(0, 5)
    .map((cible) => ({ cible }))
}
