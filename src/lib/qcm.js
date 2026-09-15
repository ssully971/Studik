import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'

export async function getAllQcm({ matiere, statut } = {}) {
  let query = supabase.from('qcm').select('*')

  if (statut) query = query.eq('statut', statut)
  else query = query.neq('statut', 'archive')

  const { data, error } = await query.order('date_creation', { ascending: false })
  if (error) throw error

  if (matiere) {
    return data.filter((q) => (q.matieres || []).includes(matiere))
  }
  return data
}

export function texteRechercheQcm(qcm) {
  const valeursQuestions = (qcm.questions || []).flatMap((q) => [
    q.enonce,
    q.explication,
    ...(q.items || []).flatMap((item) => [item.texte, item.explication]),
  ])
  return [qcm.titre, ...(qcm.tags || []), ...(qcm.matieres || []), ...valeursQuestions]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export async function getQcmById(id) {
  const { data, error } = await supabase.from('qcm').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function insertQcm(qcmArray) {
  return upsertPartiel('qcm', qcmArray)
}

export async function updateQcmStatut(id, statut) {
  const { error } = await supabase.from('qcm').update({ statut }).eq('id', id)
  if (error) throw error
}

export async function updateQcmTags(id, tags) {
  const { error } = await supabase.from('qcm').update({ tags }).eq('id', id)
  if (error) throw error
}

export async function updateQcm(id, champs) {
  const { error } = await supabase.from('qcm').update(champs).eq('id', id)
  if (error) throw error
}

export async function deleteQcm(id) {
  const { error } = await supabase.from('qcm').delete().eq('id', id)
  if (error) throw error
}

export async function getAllQcmIds() {
  const { data, error } = await supabase.from('qcm').select('id')
  if (error) throw error
  return data.map((q) => q.id)
}

// --- Tentatives ---

export async function enregistrerTentativeQcm({ qcmId, mode, score, scoreMax, reponses, dureeUtiliseeSecondes }) {
  const { error } = await supabase.from('qcm_tentatives').insert({
    qcm_id: qcmId,
    mode,
    score,
    score_max: scoreMax,
    reponses,
    duree_utilisee_secondes: dureeUtiliseeSecondes || null,
    a_revoir: score < scoreMax,
  })
  if (error) throw error
}

export async function getTentativesQcm(qcmId) {
  const { data, error } = await supabase
    .from('qcm_tentatives')
    .select('*')
    .eq('qcm_id', qcmId)
    .order('date_tentative', { ascending: false })
  if (error) throw error
  return data
}

export async function getAllTentativesQcmStats() {
  const { data, error } = await supabase
    .from('qcm_tentatives')
    .select('id, mode, score, score_max, a_revoir, date_tentative, qcm(id, titre, matieres)')
    .order('date_tentative', { ascending: false })
  if (error) throw error
  return data
}

// Une seule ligne par QCM : sa tentative la plus récente, uniquement si elle est encore
// marquée à revoir (une tentative plus récente réussie fait disparaître le QCM de la liste).
export async function getQcmTentativesARevoir() {
  const { data, error } = await supabase
    .from('qcm_tentatives')
    .select('id, mode, score, score_max, reponses, date_tentative, a_revoir, qcm_id, qcm(id, titre, matieres, questions, tags)')
    .order('date_tentative', { ascending: false })
  if (error) throw error

  const vus = new Set()
  const dernieres = []
  data.forEach((t) => {
    if (vus.has(t.qcm_id)) return
    vus.add(t.qcm_id)
    if (t.a_revoir) dernieres.push(t)
  })
  return dernieres
}

export function questionsRateesDeLaTentative(qcm, tentative) {
  const indices = []
  qcm.questions.forEach((q, i) => {
    const reponsesQuestion = (tentative.reponses && tentative.reponses[i]) || []
    const correcte = q.items.every((item, j) => Boolean(reponsesQuestion[j]) === Boolean(item.correct))
    if (!correcte) indices.push(i)
  })
  return indices
}

// Rassemble les questions ratées (dernière tentative de chaque QCM concerné) selon un
// périmètre : un QCM précis, une matière, ou un ou plusieurs tags.
export async function getQuestionsRateesParScope({ qcmId, matiere, tags } = {}) {
  const dernieres = await getQcmTentativesARevoir()
  const filtrees = dernieres.filter((t) => {
    if (qcmId) return t.qcm_id === qcmId
    if (matiere) return (t.qcm.matieres || []).includes(matiere)
    if (tags && tags.length > 0) return tags.some((tag) => (t.qcm.tags || []).includes(tag))
    return false
  })

  const questions = []
  filtrees.forEach((t) => {
    questionsRateesDeLaTentative(t.qcm, t).forEach((i) => {
      questions.push({ question: t.qcm.questions[i], qcmId: t.qcm.id, qcmTitre: t.qcm.titre })
    })
  })
  return questions
}

export async function marquerTentativeQcmRevue(id) {
  const { error } = await supabase.from('qcm_tentatives').update({ a_revoir: false }).eq('id', id)
  if (error) throw error
}

export async function deleteTentativeQcm(id) {
  const { error } = await supabase.from('qcm_tentatives').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllTentativesQcm() {
  const { error } = await supabase.from('qcm_tentatives').delete().not('id', 'is', null)
  if (error) throw error
}

export async function deleteTentativesQcmByMatiere(matiere) {
  const { data: qcmIds, error: err1 } = await supabase.from('qcm').select('id').contains('matieres', [matiere])
  if (err1) throw err1

  const ids = qcmIds.map((q) => q.id)
  if (ids.length === 0) return

  const { error } = await supabase.from('qcm_tentatives').delete().in('qcm_id', ids)
  if (error) throw error
}

// --- Notation (barème Outremed) ---
// Par question : 1 point si 0 erreur, 0,5 point si 1 erreur, 0 point si 2 erreurs ou plus.
// Une "erreur" = un item où la réponse cochée ne correspond pas à la bonne réponse.

export function scoreQuestion(items, reponsesItem) {
  let erreurs = 0
  items.forEach((item, i) => {
    if (Boolean(reponsesItem[i]) !== Boolean(item.correct)) erreurs++
  })
  if (erreurs === 0) return 1
  if (erreurs === 1) return 0.5
  return 0
}

export function scoreQcm(questions, reponses) {
  let total = 0
  questions.forEach((q, i) => {
    total += scoreQuestion(q.items, reponses[i] || [])
  })
  return { score: total, scoreMax: questions.length }
}

export async function getAllQcmRaw() {
  const { data, error } = await supabase.from('qcm').select('*')
  if (error) throw error
  return data
}

export async function getAllQcmTentativesRaw() {
  const { data, error } = await supabase.from('qcm_tentatives').select('*')
  if (error) throw error
  return data
}

export async function restaurerTentativesQcm(tentativesArray) {
  if (!tentativesArray || tentativesArray.length === 0) return
  const { error } = await supabase.from('qcm_tentatives').upsert(tentativesArray, { onConflict: 'id' })
  if (error) throw error
}

export async function deleteAllQcm() {
  const { error } = await supabase.from('qcm').delete().not('id', 'is', null)
  if (error) throw error
}
