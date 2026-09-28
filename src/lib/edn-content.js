import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'
import { paginerTout } from './supabase-paginate.js'

// Dossiers et questions EDN (§4.2). Un dossier importé porte ses questions imbriquées
// (item.questions) : elles sont éclatées ici en lignes edn_questions avec dossier_id + ordre,
// jamais stockées comme jsonb imbriqué (contrairement à qcm.questions, ici chaque question a sa
// propre ligne — elle doit pouvoir être une cible de révision/SRS indépendante, sauf DP/KFP/TCS
// où l'unité de révision reste le dossier entier, voir §4.3).

export async function getAllDossierIds() {
  const data = await paginerTout(() => supabase.from('edn_dossiers').select('id').order('id'))
  return data.map((d) => d.id)
}

export async function getAllQuestionIds() {
  const data = await paginerTout(() => supabase.from('edn_questions').select('id').order('id'))
  return data.map((q) => q.id)
}

// Insère/upserte des dossiers avec leurs questions imbriquées. `items` = tableau d'objets
// edn_dossiers avec un champ `questions` optionnel (tableau d'objets edn_questions sans
// dossier_id, ordre déduit de la position dans le tableau si absent).
export async function insertDossiersAvecQuestions(items) {
  const dossiers = items.map(({ questions, ...d }) => d)
  const dossiersInseres = await upsertPartiel('edn_dossiers', dossiers)

  const questions = []
  items.forEach((d) => {
    ;(d.questions || []).forEach((q, i) => {
      questions.push({ ...q, dossier_id: d.id, ordre: q.ordre ?? i })
    })
  })
  if (questions.length > 0) await upsertPartiel('edn_questions', questions)

  return dossiersInseres
}

// Questions isolées (dossier_id null) — cible d'import séparée (§6 : "edn_questions (questions
// isolées)").
export async function insertQuestionsIsolees(items) {
  const withoutDossier = items.map((q) => ({ ...q, dossier_id: null, ordre: null }))
  return upsertPartiel('edn_questions', withoutDossier)
}

export async function getDossierAvecQuestions(id) {
  const { data: dossier, error: errDossier } = await supabase.from('edn_dossiers').select('*').eq('id', id).single()
  if (errDossier) throw errDossier
  const { data: questions, error: errQuestions } = await supabase
    .from('edn_questions')
    .select('*')
    .eq('dossier_id', id)
    .order('ordre')
  if (errQuestions) throw errQuestions
  return { ...dossier, questions }
}

export async function getQuestionById(id) {
  const { data, error } = await supabase.from('edn_questions').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function getAllDossiers() {
  return paginerTout(() => supabase.from('edn_dossiers').select('*').order('date_creation', { ascending: false }).order('id', { ascending: false }))
}

export async function getQuestionsIsolees() {
  return paginerTout(() =>
    supabase
      .from('edn_questions')
      .select('*')
      .is('dossier_id', null)
      .order('date_creation', { ascending: false })
      .order('id', { ascending: false })
  )
}

// Mises à jour génériques (statut, tags, signalement d'erreur — §7.3 Banque) : mêmes champs
// partiels que updateCas/updateMatiere côté P2, pas une fonction dédiée par champ.
export async function updateQuestion(id, champs) {
  const { error } = await supabase.from('edn_questions').update(champs).eq('id', id)
  if (error) throw error
}

export async function updateDossier(id, champs) {
  const { error } = await supabase.from('edn_dossiers').update(champs).eq('id', id)
  if (error) throw error
}
