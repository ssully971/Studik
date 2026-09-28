import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'

// Référentiels R2C (§4.1) — clé primaire "numero" (entier), pas "id" comme le reste du site.

export async function getR2cItems() {
  const { data, error } = await supabase.from('r2c_items').select('*').order('numero')
  if (error) throw error
  return data
}

export async function getAllR2cItemNumeros() {
  const { data, error } = await supabase.from('r2c_items').select('numero')
  if (error) throw error
  return data.map((i) => i.numero)
}

export async function insertR2cItems(items) {
  return upsertPartiel('r2c_items', items, 'numero')
}

export async function toggleR2cItemPrioritaire(numero, prioritaire) {
  const { error } = await supabase.from('r2c_items').update({ prioritaire }).eq('numero', numero)
  if (error) throw error
}

export async function getR2cSdd() {
  const { data, error } = await supabase.from('r2c_sdd').select('*').order('numero')
  if (error) throw error
  return data
}

export async function getAllR2cSddNumeros() {
  const { data, error } = await supabase.from('r2c_sdd').select('numero')
  if (error) throw error
  return data.map((s) => s.numero)
}

export async function insertR2cSdd(items) {
  return upsertPartiel('r2c_sdd', items, 'numero')
}
