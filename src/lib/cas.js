import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'

// --- Cas cliniques ---

export const GABARITS_CAS = {
  clinique: { itemsKey: 'signes', resultKey: 'pathologies', itemsLabel: 'Signes', resultLabel: 'Pathologies compatibles' },
  mecanisme: { itemsKey: 'evenements', resultKey: 'consequences', itemsLabel: 'Événements', resultLabel: 'Conséquences attendues' },
  structure: { itemsKey: 'elements', resultKey: 'identification', itemsLabel: 'Éléments', resultLabel: 'À identifier' },
}

export async function getCasAleatoire({ matiere, cours, niveau, tags } = {}) {
  let query = supabase.from('cas_cliniques').select('*').neq('statut', 'archive')

  if (matiere) query = query.eq('matiere', matiere)
  if (cours) query = query.eq('cours', cours)
  if (niveau) query = query.eq('niveau', niveau)
  if (tags && tags.length > 0) query = query.overlaps('tags', tags)

  const { data, error } = await query
  if (error) throw error
  if (!data || data.length === 0) return null

  const index = Math.floor(Math.random() * data.length)
  return data[index]
}

export async function getCasById(id) {
  const { data, error } = await supabase.from('cas_cliniques').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function insertCas(casArray) {
  return upsertPartiel('cas_cliniques', casArray)
}

export async function getAllCasIds() {
  const { data, error } = await supabase.from('cas_cliniques').select('id')
  if (error) throw error
  return data.map((c) => c.id)
}

export async function getAllCas() {
  const { data, error } = await supabase.from('cas_cliniques').select('*')
  if (error) throw error
  return data
}

export function texteRechercheCas(cas) {
  const enonce = cas.enonce || {}
  const reponse = cas.reponse_attendue || {}
  const valeursReponse = Object.values(reponse).flatMap((v) => {
    if (!Array.isArray(v)) return []
    return v.map((item) => (item && typeof item === 'object' ? item.label : item))
  })
  return [cas.question, enonce.situation, ...(enonce.elements || []), ...(cas.tags || []), cas.matiere, ...valeursReponse]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export async function updateCas(id, champs) {
  const { error } = await supabase.from('cas_cliniques').update(champs).eq('id', id)
  if (error) throw error
}

export async function updateCasStatut(id, statut) {
  const { error } = await supabase.from('cas_cliniques').update({ statut }).eq('id', id)
  if (error) throw error
}

export async function updateCasTags(id, tags) {
  const { error } = await supabase.from('cas_cliniques').update({ tags }).eq('id', id)
  if (error) throw error
}

export async function deleteCas(id) {
  const { error: err1 } = await supabase.from('tentatives').delete().eq('cas_id', id)
  if (err1) throw err1
  const { error } = await supabase.from('cas_cliniques').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllCas() {
  const { error } = await supabase.from('cas_cliniques').delete().not('id', 'is', null)
  if (error) throw error
}

// --- Tentatives ---

export async function enregistrerTentative(casId, reussi, reponseDonnee) {
  const { error } = await supabase.from('tentatives').insert({
    cas_id: casId,
    reussi,
    reponse_donnee: reponseDonnee,
    a_revoir: !reussi,
  })
  if (error) throw error
}

// Une seule ligne par cas : sa tentative la plus récente, uniquement si elle est encore
// marquée à revoir (une tentative plus récente réussie fait disparaître le cas de la liste).
export async function getTentativesRatees() {
  const { data, error } = await supabase
    .from('tentatives')
    .select('*, cas_cliniques(id, matiere, type, question, fiches_liees, reponse_attendue, tags)')
    .order('date_tentative', { ascending: false })

  if (error) throw error

  const vus = new Set()
  const dernieres = []
  data.forEach((t) => {
    if (vus.has(t.cas_id)) return
    vus.add(t.cas_id)
    if (t.a_revoir) dernieres.push(t)
  })
  return dernieres
}

export async function marquerCommeRevu(tentativeId) {
  const { error } = await supabase.from('tentatives').update({ a_revoir: false }).eq('id', tentativeId)
  if (error) throw error
}

// Sort une entrée de l'archive pour la remettre dans les erreurs actives (annuler un
// "marquer comme revu" fait par erreur, sans repasser une tentative).
export async function marquerCommeNonRevu(tentativeId) {
  const { error } = await supabase.from('tentatives').update({ a_revoir: true }).eq('id', tentativeId)
  if (error) throw error
}

// Archive : cas dont la tentative la plus récente était ratée mais a déjà été marquée comme
// revue (a_revoir = false) — reste visible tant que l'utilisateur ne le supprime pas lui-même,
// ou jusqu'à une nouvelle tentative réussie qui le sort naturellement de cette liste.
export async function getTentativesRevues() {
  const { data, error } = await supabase
    .from('tentatives')
    .select('*, cas_cliniques(id, matiere, type, question, fiches_liees, reponse_attendue, tags)')
    .order('date_tentative', { ascending: false })

  if (error) throw error

  const vus = new Set()
  const revues = []
  data.forEach((t) => {
    if (vus.has(t.cas_id)) return
    vus.add(t.cas_id)
    if (!t.a_revoir && !t.reussi) revues.push(t)
  })
  return revues
}

export async function deleteTentative(id) {
  const { error } = await supabase.from('tentatives').delete().eq('id', id)
  if (error) throw error
}

export async function deleteTentativesByMatiere(matiere) {
  const { data: casIds, error: err1 } = await supabase.from('cas_cliniques').select('id').eq('matiere', matiere)
  if (err1) throw err1

  const ids = casIds.map((c) => c.id)
  if (ids.length === 0) return

  const { error } = await supabase.from('tentatives').delete().in('cas_id', ids)
  if (error) throw error
}

export async function deleteAllTentatives() {
  const { error } = await supabase.from('tentatives').delete().not('id', 'is', null)
  if (error) throw error
}

export async function getStatsTentatives() {
  const { data, error } = await supabase
    .from('tentatives')
    .select('id, reussi, date_tentative, cas_cliniques(matiere, type, question)')
    .order('date_tentative', { ascending: false })
  if (error) throw error
  return data
}

// --- Cascade de renommage (Organisation) : voir lib/fiches.js pour le contexte complet.

export async function renommerMatiereCas(ancienNom, nouveauNom) {
  const { error } = await supabase.from('cas_cliniques').update({ matiere: nouveauNom }).eq('matiere', ancienNom)
  if (error) throw error
}

export async function renommerCoursCas(nomMatiere, ancienNom, nouveauNom) {
  const { error } = await supabase.from('cas_cliniques').update({ cours: nouveauNom }).eq('matiere', nomMatiere).eq('cours', ancienNom)
  if (error) throw error
}

export async function restaurerTentatives(tentativesArray) {
  if (!tentativesArray || tentativesArray.length === 0) return
  const clean = tentativesArray.map((t) => ({
    id: t.id,
    cas_id: t.cas_id || t.cas_cliniques?.id,
    reussi: t.reussi,
    reponse_donnee: t.reponse_donnee,
    a_revoir: t.a_revoir,
    date_tentative: t.date_tentative,
  }))
  const { error } = await supabase.from('tentatives').upsert(clean, { onConflict: 'id' })
  if (error) throw error
}
