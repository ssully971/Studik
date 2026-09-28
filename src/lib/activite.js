import { supabase } from './supabase.js'
import { paginerTout } from './supabase-paginate.js'

const FENETRE_JOURS = 140

// Agrégat (compte par jour pour la heatmap) calculé côté client à partir de tout l'historique
// de la fenêtre — même sur 140 jours, un usage intensif peut dépasser 1000 lignes sur
// `tentatives`/`qcm_tentatives` (catégorie C, voir "Lectures Supabase et pagination" de
// CLAUDE.md) : mêmes helper que les lectures A plutôt qu'un plafond implicite par date.
export async function getActiviteParJour() {
  const depuis = new Date()
  depuis.setDate(depuis.getDate() - FENETRE_JOURS)
  const depuisIso = depuis.toISOString()
  const depuisJour = depuisIso.slice(0, 10)

  const [tentativesData, tentativesQcmData, checkinsData] = await Promise.all([
    paginerTout(() =>
      supabase.from('tentatives').select('date_tentative').gte('date_tentative', depuisIso).order('date_tentative').order('id')
    ),
    paginerTout(() =>
      supabase.from('qcm_tentatives').select('date_tentative').gte('date_tentative', depuisIso).order('date_tentative').order('id')
    ),
    paginerTout(() => supabase.from('checkins').select('jour').gte('jour', depuisJour).order('jour')),
  ])

  const compte = {}
  const ajouter = (dateStr) => {
    const jour = dateStr.slice(0, 10)
    compte[jour] = (compte[jour] || 0) + 1
  }

  tentativesData.forEach((t) => ajouter(t.date_tentative))
  tentativesQcmData.forEach((t) => ajouter(t.date_tentative))
  checkinsData.forEach((c) => ajouter(c.jour))

  const checkinsParJour = {}
  checkinsData.forEach((c) => {
    checkinsParJour[c.jour] = true
  })

  return { compte, checkinsParJour }
}

export { FENETRE_JOURS }
