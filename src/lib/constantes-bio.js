import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'

// Constantes biologiques (§4.4, §5.11) : bilans en tableau, normes masquables. La modale
// d'affichage arrive au lot 6 (phase 2) ; ce module porte la cible d'import (§6, lot 2).

export async function getAllConstanteIds() {
  const { data, error } = await supabase.from('constantes_bio').select('id')
  if (error) throw error
  return data.map((c) => c.id)
}

export async function insertConstantes(items) {
  return upsertPartiel('constantes_bio', items)
}

export async function getConstantes() {
  const { data, error } = await supabase.from('constantes_bio').select('*').order('categorie').order('ordre')
  if (error) throw error
  return data
}
