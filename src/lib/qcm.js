import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'
export { scoreQuestion, scoreQcm, questionsRateesDeLaTentative } from './scoring.js'
import { questionsRateesDeLaTentative } from './scoring.js'

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

// Sort une entrée de l'archive pour la remettre dans les erreurs actives (annuler un
// "marquer comme revu" fait par erreur, sans refaire le QCM).
export async function marquerTentativeQcmNonRevue(id) {
  const { error } = await supabase.from('qcm_tentatives').update({ a_revoir: true }).eq('id', id)
  if (error) throw error
}

// --- Cascade de renommage (Organisation) : voir lib/fiches.js pour le contexte complet.
// `matieres` est un tableau (un QCM peut couvrir plusieurs matières) : pas de remplacement
// SQL direct possible sur un élément de tableau, on relit puis réécrit chaque ligne concernée.

export async function renommerMatiereQcm(ancienNom, nouveauNom) {
  const { data, error } = await supabase.from('qcm').select('id, matieres').contains('matieres', [ancienNom])
  if (error) throw error
  for (const q of data) {
    const matieres = q.matieres.map((m) => (m === ancienNom ? nouveauNom : m))
    const { error: err2 } = await supabase.from('qcm').update({ matieres }).eq('id', q.id)
    if (err2) throw err2
  }
}

export async function renommerCoursQcm(nomMatiere, ancienNom, nouveauNom) {
  const { error } = await supabase.from('qcm').update({ cours: nouveauNom }).contains('matieres', [nomMatiere]).eq('cours', ancienNom)
  if (error) throw error
}

// Archive : QCM dont la tentative la plus récente était imparfaite mais a déjà été marquée
// comme revue (a_revoir = false) — reste visible tant que l'utilisateur ne le supprime pas
// lui-même, ou jusqu'à une nouvelle tentative parfaite qui le sort naturellement de la liste.
export async function getQcmTentativesRevues() {
  const { data, error } = await supabase
    .from('qcm_tentatives')
    .select('id, mode, score, score_max, reponses, date_tentative, a_revoir, qcm_id, qcm(id, titre, matieres, questions, tags)')
    .order('date_tentative', { ascending: false })
  if (error) throw error

  const vus = new Set()
  const revues = []
  data.forEach((t) => {
    if (vus.has(t.qcm_id)) return
    vus.add(t.qcm_id)
    if (!t.a_revoir && Number(t.score) < Number(t.score_max)) revues.push(t)
  })
  return revues
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
