import { supabase } from './supabase.js'

const FENETRE_JOURS = 140

export async function getActiviteParJour() {
  const depuis = new Date()
  depuis.setDate(depuis.getDate() - FENETRE_JOURS)
  const depuisIso = depuis.toISOString()
  const depuisJour = depuisIso.slice(0, 10)

  const [tentatives, tentativesQcm, checkins] = await Promise.all([
    supabase.from('tentatives').select('date_tentative').gte('date_tentative', depuisIso),
    supabase.from('qcm_tentatives').select('date_tentative').gte('date_tentative', depuisIso),
    supabase.from('checkins').select('jour').gte('jour', depuisJour),
  ])

  if (tentatives.error) throw tentatives.error
  if (tentativesQcm.error) throw tentativesQcm.error
  if (checkins.error) throw checkins.error

  const compte = {}
  const ajouter = (dateStr) => {
    const jour = dateStr.slice(0, 10)
    compte[jour] = (compte[jour] || 0) + 1
  }

  tentatives.data.forEach((t) => ajouter(t.date_tentative))
  tentativesQcm.data.forEach((t) => ajouter(t.date_tentative))
  checkins.data.forEach((c) => ajouter(c.jour))

  return compte
}

export { FENETRE_JOURS }
