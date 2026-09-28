import { supabase } from './supabase.js'
import { todayLocal } from './date-utils.js'
import { paginerTout } from './supabase-paginate.js'

export async function checkinAujourdhui() {
  const jour = todayLocal()
  const { error } = await supabase.from('checkins').upsert({ jour }, { onConflict: 'jour' })
  if (error) throw error
  return jour
}

export async function getCheckins() {
  // `jour` est la clé primaire de cette table (voir CLAUDE.md) : déjà un ordre total à lui
  // seul, aucun tiebreaker à ajouter.
  const data = await paginerTout(() => supabase.from('checkins').select('jour').order('jour'))
  return data.map((d) => d.jour)
}

export async function deleteAllCheckins() {
  const { error } = await supabase.from('checkins').delete().not('jour', 'is', null)
  if (error) throw error
}

export async function restaurerCheckins(joursArray) {
  if (!joursArray || joursArray.length === 0) return
  const lignes = joursArray.map((jour) => ({ jour }))
  const { error } = await supabase.from('checkins').upsert(lignes, { onConflict: 'jour' })
  if (error) throw error
}
