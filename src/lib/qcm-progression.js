import { supabase } from './supabase.js'

export async function getProgressions() {
  const { data, error } = await supabase
    .from('qcm_progression')
    .select('*, qcm(titre, questions)')
    .order('date_derniere_activite', { ascending: false })
  if (error) throw error
  return data
}

export async function getProgressionByQcmId(qcmId) {
  const { data, error } = await supabase.from('qcm_progression').select('*').eq('qcm_id', qcmId).maybeSingle()
  if (error) throw error
  return data
}

export async function sauvegarderProgression({ qcmId, mode, indexCourant, reponses, dateFinPrevue, chronoEcouleSecondes }) {
  const { error } = await supabase.from('qcm_progression').upsert(
    {
      qcm_id: qcmId,
      mode,
      index_courant: indexCourant,
      reponses,
      date_fin_prevue: dateFinPrevue || null,
      chrono_ecoule_secondes: chronoEcouleSecondes,
      date_derniere_activite: new Date().toISOString(),
    },
    { onConflict: 'qcm_id' }
  )
  if (error) throw error
}

export async function supprimerProgression(qcmId) {
  const { error } = await supabase.from('qcm_progression').delete().eq('qcm_id', qcmId)
  if (error) throw error
}
