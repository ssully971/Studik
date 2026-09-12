import { supabase } from './supabase.js'

export async function ajouterCapture(texte) {
  const { error } = await supabase.from('captures').insert({ texte })
  if (error) throw error
}

export async function getCapturesNonTraitees() {
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .eq('traitee', false)
    .order('date_creation', { ascending: false })
  if (error) throw error
  return data
}

export async function marquerCaptureTraitee(id) {
  const { error } = await supabase.from('captures').update({ traitee: true }).eq('id', id)
  if (error) throw error
}

export async function supprimerCapture(id) {
  const { error } = await supabase.from('captures').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllCaptures() {
  const { error } = await supabase.from('captures').delete().not('id', 'is', null)
  if (error) throw error
}

export async function getAllCaptures() {
  const { data, error } = await supabase.from('captures').select('*')
  if (error) throw error
  return data
}

export async function deleteCapturesTraitees() {
  const { error } = await supabase.from('captures').delete().eq('traitee', true)
  if (error) throw error
}

export async function restaurerCaptures(capturesArray) {
  if (!capturesArray || capturesArray.length === 0) return
  const { error } = await supabase.from('captures').upsert(capturesArray, { onConflict: 'id' })
  if (error) throw error
}
