import { supabase } from './supabase.js'

export async function getTags() {
  const { data, error } = await supabase.from('tags_reference').select('nom').order('nom')
  if (error) throw error
  return data.map((t) => t.nom)
}

export async function ajouterTag(nom) {
  const { error } = await supabase.from('tags_reference').upsert({ nom }, { onConflict: 'nom' })
  if (error) throw error
}

export async function supprimerTag(nom) {
  const { error } = await supabase.from('tags_reference').delete().eq('nom', nom)
  if (error) throw error
}
