import { supabase } from './supabase.js'

export async function getTags() {
  const { data, error } = await supabase.from('tags_reference').select('nom').order('nom')
  if (error) throw error
  return data.map((t) => t.nom)
}

// Comme getTags(), mais renvoie aussi le périmètre (année/semestre) de chaque tag —
// null si le tag s'applique à toutes les périodes.
export async function getTagsAvecPerimetre() {
  const { data, error } = await supabase.from('tags_reference').select('nom, perimetre').order('nom')
  if (error) throw error
  return data
}

export async function ajouterTag(nom, perimetre = null) {
  const { error } = await supabase.from('tags_reference').upsert({ nom, perimetre }, { onConflict: 'nom' })
  if (error) throw error
}

export async function modifierPerimetreTag(nom, perimetre) {
  const { error } = await supabase.from('tags_reference').update({ perimetre }).eq('nom', nom)
  if (error) throw error
}

export async function supprimerTag(nom) {
  const { error } = await supabase.from('tags_reference').delete().eq('nom', nom)
  if (error) throw error
}

// Accepte un tableau de noms (anciennes sauvegardes) ou de {nom, perimetre} (sauvegardes
// actuelles), pour rester compatible avec les deux formats à la restauration.
export async function restaurerTags(tagsArray) {
  if (!tagsArray || tagsArray.length === 0) return
  const lignes = tagsArray.map((t) => (typeof t === 'string' ? { nom: t, perimetre: null } : { nom: t.nom, perimetre: t.perimetre ?? null }))
  const { error } = await supabase.from('tags_reference').upsert(lignes, { onConflict: 'nom' })
  if (error) throw error
}
