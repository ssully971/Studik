import { supabase } from './supabase.js'

// Upsert "manuel" : un id déjà existant déclenche un update (seuls les champs
// fournis sont écrasés), un id nouveau déclenche un insert complet.
// Nécessaire car `supabase.upsert()` construit toujours une ligne complète
// avant de vérifier le conflit, donc une mise à jour partielle omettant une
// colonne NOT NULL (ex. "titre") est rejetée même quand la ligne existe déjà.
//
// `idColumn` : nom de la colonne clé primaire dans la table ET dans chaque item (par défaut
// "id" — "numero" pour r2c_items/r2c_sdd, voir lib/r2c.js, dont la clé est un entier).
export async function upsertPartiel(table, items, idColumn = 'id') {
  const results = []
  for (const item of items) {
    const idValeur = item[idColumn]
    const { data: existing, error: errCheck } = await supabase.from(table).select(idColumn).eq(idColumn, idValeur).maybeSingle()
    if (errCheck) throw errCheck

    if (existing) {
      const { [idColumn]: _id, ...champs } = item
      const { data, error } = await supabase.from(table).update(champs).eq(idColumn, idValeur).select()
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
