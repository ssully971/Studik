import { supabase } from './supabase.js'

// Petite table clé/valeur pour synchroniser entre appareils les préférences visuelles qui ne
// vivaient qu'en localStorage (fond d'écran, flou, historique, mode verre dépoli) — voir
// lib/fond.js et lib/glass.js. Le thème reste volontairement local par appareil, comme avant.
export async function lirePreference(cle) {
  const { data, error } = await supabase.from('preferences').select('valeur').eq('cle', cle).maybeSingle()
  if (error) throw error
  return data ? data.valeur : undefined
}

export async function ecrirePreference(cle, valeur) {
  const { error } = await supabase.from('preferences').upsert({ cle, valeur, date_maj: new Date().toISOString() }, { onConflict: 'cle' })
  if (error) throw error
}
