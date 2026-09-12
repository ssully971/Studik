import { supabase } from './supabase.js'
import { todayLocal } from './date-utils.js'

export async function checkinAujourdhui() {
  const jour = todayLocal()
  const { error } = await supabase.from('checkins').upsert({ jour }, { onConflict: 'jour' })
  if (error) throw error
  return jour
}

export async function getCheckins() {
  const { data, error } = await supabase.from('checkins').select('jour').order('jour')
  if (error) throw error
  return data.map((d) => d.jour)
}
