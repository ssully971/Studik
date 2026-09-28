import { supabase } from './supabase.js'

// Tentatives EDN (§4.3) — append-only, id généré côté client (crypto.randomUUID(), voir §8 lot 8
// pour l'idempotence hors-ligne). `cible` = 'q:<id>' pour une question isolée, 'd:<id>' pour un
// dossier entier (unité de révision, voir §4.3 "on ne révise pas une question de DP hors de son
// dossier").
export async function enregistrerTentative({ cible, mode, reponses, score, scoreMax, detail, dureeS, tagsErreur }) {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('edn_tentatives').insert({
    id,
    cible,
    mode,
    reponses,
    score,
    score_max: scoreMax,
    detail: detail ?? null,
    duree_s: dureeS ?? null,
    tags_erreur: tagsErreur || [],
    date_tentative: new Date().toISOString(),
  })
  if (error) throw error
  return id
}

export function cibleQuestion(id) {
  return `q:${id}`
}

export function cibleDossier(id) {
  return `d:${id}`
}
