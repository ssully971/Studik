import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'
import { paginerTout } from './supabase-paginate.js'

// ECOS (§4.4, §5.9) : accès aux stations. Le chronomètre pur vit dans lib/ecos-timer.js, la
// notation dans lib/ecos-scoring.js, les tentatives dans lib/ecos-tentatives.js — jamais mélangés
// ici pour garder ce fichier aligné sur le principe "un fichier par domaine".

export async function getAllStationIds() {
  const data = await paginerTout(() => supabase.from('ecos_stations').select('id').order('id'))
  return data.map((s) => s.id)
}

export async function insertStations(items) {
  return upsertPartiel('ecos_stations', items)
}

export async function getStations() {
  return paginerTout(() => supabase.from('ecos_stations').select('*').order('date_creation', { ascending: false }).order('id', { ascending: false }))
}

export async function getStationById(id) {
  const { data, error } = await supabase.from('ecos_stations').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// 10 des 11 domaines de compétence du guide CNG (§5.9) — le 11e reste à compléter par Sullivan
// (voir docs/externat/A-FAIRE-SULLIVAN.md). Liste de référence pour le filtre de la page Stations,
// pas une contrainte stricte en base (domaine reste un texte libre côté schéma, comme tags/matières
// côté P2 : Sullivan peut en saisir un absent de cette liste sans que rien ne le bloque).
export const DOMAINES_ECOS = [
  'Annonce',
  'Communication interprofessionnelle',
  'Éducation / prévention',
  'Entretien / interrogatoire',
  'Examen clinique',
  'Iconographie',
  'Procédure',
  'Stratégie diagnostique',
  'Stratégie pertinente de prise en charge',
  "Synthèse des résultats d'examens paracliniques",
]
