import { supabase } from './supabase.js'
import { upsertPartiel } from './upsert.js'

// Ne renvoie que les matières de premier niveau (sans parent) : c'est ce qu'attendent
// tous les sélecteurs/filtres "matière" existants (une sous-matière ne s'y choisit pas).
export async function getMatieres({ annee, semestre } = {}) {
  let query = supabase.from('matieres').select('*').eq('archive', false).is('parent_id', null)

  if (annee) query = query.eq('annee', annee)
  if (semestre) query = query.eq('semestre', semestre)

  const { data, error } = await query.order('ordre_affichage')
  if (error) throw error
  return data
}

export async function getSousMatieres(parentId) {
  if (!parentId) return []
  const { data, error } = await supabase
    .from('matieres')
    .select('*')
    .eq('archive', false)
    .eq('parent_id', parentId)
    .order('ordre_affichage')
  if (error) throw error
  return data
}

// Toutes les matières (premier niveau + sous-matières), sans filtre de période : sert à
// construire les tables de couleurs et les listes de gestion, où on a besoin de tout voir.
export async function getAllMatieresAvecSousMatieres() {
  const { data, error } = await supabase.from('matieres').select('*').eq('archive', false).order('ordre_affichage')
  if (error) throw error
  return data
}

export async function getMatiereIdParNom(nom) {
  const { data, error } = await supabase.from('matieres').select('id').eq('nom', nom).maybeSingle()
  if (error) throw error
  return data?.id || null
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

// Construit une table nom de matière -> {couleur, type, parentId, id}, pour afficher la
// couleur propre à chaque matière (avec repli sur la couleur du type) partout où du contenu
// est listé. À construire à partir de getAllMatieresAvecSousMatieres() si des sous-matières
// peuvent apparaître, ou de getMatieres() sinon.
export function buildMatiereColorMap(matieres) {
  const map = {}
  matieres.forEach((m) => {
    map[m.nom] = { couleur: m.couleur, type: m.type, parentId: m.parent_id, id: m.id }
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

// Résolution centralisée : une sous-matière n'a jamais de couleur propre effective, elle
// reprend toujours celle de sa matière parente (le champ "couleur" éventuellement renseigné
// sur sa propre ligne n'est jamais consulté). nomMatiere doit être le nom de la matière
// parente ; nomSousMatiere ne sert qu'à décider d'éclaircir la teinte pour la distinguer.
export function getCouleurEffective(nomMatiere, nomSousMatiere, map, typeSecours) {
  const base = couleurTab(nomMatiere, typeSecours, map)
  if (!nomSousMatiere) return base
  return `color-mix(in srgb, ${base} 55%, white)`
}
