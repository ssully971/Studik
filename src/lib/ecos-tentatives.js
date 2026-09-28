import { supabase } from './supabase.js'

// Tentatives ECOS (§4.4, §5.9) — append-only comme edn-tentatives.js, mais sans SRS : les
// stations ECOS ne sont pas revues par répétition espacée (hors périmètre de la spec).
export async function enregistrerTentativeEcos({ stationId, mode, cochees, score, scoreMax, global = null, dureeS = null, notes = null }) {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('ecos_tentatives').insert({
    id,
    station_id: stationId,
    mode,
    cochees,
    score,
    score_max: scoreMax,
    global,
    duree_s: dureeS,
    notes,
    date_tentative: new Date().toISOString(),
  })
  if (error) throw error
  return id
}

export async function getTentativesEcos(stationId) {
  const { data, error } = await supabase
    .from('ecos_tentatives')
    .select('*')
    .eq('station_id', stationId)
    .order('date_tentative', { ascending: false })
  if (error) throw error
  return data
}

// Toutes stations confondues (§8 lot 7, page Stats — "ECOS par domaine").
export async function getToutesLesTentativesEcos() {
  const { data, error } = await supabase.from('ecos_tentatives').select('*').order('date_tentative', { ascending: true })
  if (error) throw error
  return data
}
