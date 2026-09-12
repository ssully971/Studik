import { supabase } from './supabase.js'

export async function getMatieres({ annee, semestre } = {}) {
  let query = supabase.from('matieres').select('*').eq('archive', false)

  if (annee) query = query.eq('annee', annee)
  if (semestre) query = query.eq('semestre', semestre)

  const { data, error } = await query.order('ordre_affichage')
  if (error) throw error
  return data
}

export async function insertMatieres(matieresArray) {
  const { data, error } = await supabase.from('matieres').upsert(matieresArray, { onConflict: 'id' }).select()
  if (error) throw error
  return data
}

export async function getAllMatiereIds() {
  const { data, error } = await supabase.from('matieres').select('id')
  if (error) throw error
  return data.map((m) => m.id)
}

export async function getAllMatiereNoms() {
  const { data, error } = await supabase.from('matieres').select('nom')
  if (error) throw error
  return data.map((m) => m.nom)
}
export async function updateMatiere(id, champs) {
  const { error } = await supabase.from('matieres').update(champs).eq('id', id)
  if (error) throw error
}

export async function deleteMatiere(id) {
  const { error } = await supabase.from('matieres').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllMatieres() {
  const { error } = await supabase.from('matieres').delete().not('id', 'is', null)
  if (error) throw error
}
