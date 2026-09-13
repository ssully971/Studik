import { supabase } from './supabase.js'

// Upsert "manuel" : un id déjà existant déclenche un update (seuls les champs
// fournis sont écrasés), un id nouveau déclenche un insert complet.
// Nécessaire car `supabase.upsert()` construit toujours une ligne complète
// avant de vérifier le conflit, donc une mise à jour partielle omettant une
// colonne NOT NULL (ex. "titre") est rejetée même quand la ligne existe déjà.
export async function upsertPartiel(table, items) {
  const results = []
  for (const item of items) {
    const { data: existing, error: errCheck } = await supabase.from(table).select('id').eq('id', item.id).maybeSingle()
    if (errCheck) throw errCheck

    if (existing) {
      const { id, ...champs } = item
      const { data, error } = await supabase.from(table).update(champs).eq('id', id).select()
      if (error) throw error
      results.push(data[0])
    } else {
      const { data, error } = await supabase.from(table).insert(item).select()
      if (error) throw error
      results.push(data[0])
    }
  }
  return results
}
