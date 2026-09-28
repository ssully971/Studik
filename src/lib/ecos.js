import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'

// ECOS (§4.4, §5.9). Le joueur/chronomètre arrive au lot 5 (phase 2) ; ce module ne porte pour
// l'instant que ce qu'il faut à la cible d'import (§6, lot 2).

export async function getAllStationIds() {
  const { data, error } = await supabase.from('ecos_stations').select('id')
  if (error) throw error
  return data.map((s) => s.id)
}

export async function insertStations(items) {
  return upsertPartiel('ecos_stations', items)
}

export async function getStations() {
  const { data, error } = await supabase.from('ecos_stations').select('*').order('date_creation', { ascending: false })
  if (error) throw error
  return data
}
