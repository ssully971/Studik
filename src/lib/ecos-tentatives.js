import { supabase } from './supabase.js'
import { mettreEnFile } from './offline-queue.js'
import { paginerTout } from './supabase-paginate.js'

// Tentatives ECOS (§4.4, §5.9) — append-only comme edn-tentatives.js, mais sans SRS : les
// stations ECOS ne sont pas revues par répétition espacée (hors périmètre de la spec).
export async function enregistrerTentativeEcos({ stationId, mode, cochees, score, scoreMax, global = null, dureeS = null, notes = null }) {
  const id = crypto.randomUUID()
  const ligne = {
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
  }

  // Mise en file hors-ligne (§8 lot 8) — même mécanisme que edn-tentatives.js, jamais de SRS ici
  // de toute façon (pas de recalcul à faire au retour du réseau pour l'ECOS).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await mettreEnFile('ecos_tentatives', id, ligne)
    return id
  }

  try {
    const { error } = await supabase.from('ecos_tentatives').insert(ligne)
    if (error) throw error
  } catch (err) {
    if (err instanceof TypeError) {
      await mettreEnFile('ecos_tentatives', id, ligne)
      return id
    }
    throw err
  }
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
  return paginerTout(() => supabase.from('ecos_tentatives').select('*').order('date_tentative', { ascending: true }).order('id', { ascending: true }))
}

// Restauration de sauvegarde (§ Paramètres) : upsert direct, append-only comme le reste de
// cette table.
export async function restaurerTentativesEcos(tentatives) {
  if (!tentatives || tentatives.length === 0) return
  const { error } = await supabase.from('ecos_tentatives').upsert(tentatives, { onConflict: 'id' })
  if (error) throw error
}
