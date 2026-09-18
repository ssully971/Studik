import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'

export async function getMatieres({ annee, semestre } = {}) {
  let query = supabase.from('matieres').select('*').eq('archive', false)

  if (annee) query = query.eq('annee', annee)
  if (semestre) query = query.eq('semestre', semestre)

  const { data, error } = await query.order('ordre_affichage')
  if (error) throw error
  return data
}

export async function insertMatieres(matieresArray) {
  return upsertPartiel('matieres', matieresArray)
}

export async function getAllMatiereIds() {
  const { data, error } = await supabase.from('matieres').select('id')
  if (error) throw error
  return data.map((m) => m.id)
}

export async function getAllMatiereNoms() {
  const { data, error } = await supabase.from('matieres').select('nom')
  if (error) throw error
  return data.map((m) => m.nom)
}
export async function updateMatiere(id, champs) {
  const { error } = await supabase.from('matieres').update(champs).eq('id', id)
  if (error) throw error
}

export async function deleteMatiere(id) {
  const { error } = await supabase.from('matieres').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllMatieres() {
  const { error } = await supabase.from('matieres').delete().not('id', 'is', null)
  if (error) throw error
}

// Construit une table nom de matière -> {couleur, type}, pour afficher la couleur propre
// à chaque matière (avec repli sur la couleur du type) partout où du contenu est listé.
export function buildMatiereColorMap(matieres) {
  const map = {}
  matieres.forEach((m) => {
    map[m.nom] = { couleur: m.couleur, type: m.type }
  })
  return map
}

// nomMatiere peut être un nom unique (fiches/cas) ou un tableau de noms (QCM, on prend le premier).
export function couleurTab(nomMatiere, typeSecours, map) {
  const nom = Array.isArray(nomMatiere) ? nomMatiere[0] : nomMatiere
  const info = map[nom]
  const type = info?.type || typeSecours || 'clinique'
  return info?.couleur || `var(--${type})`
}
