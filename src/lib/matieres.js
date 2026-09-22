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

// Générique : renvoie les enfants directs d'un noeud de la hiérarchie matières (sous-matières
// d'une matière, ou cours d'une sous-matière / d'une matière sans sous-matière).
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

export const getEnfantsMatiere = getSousMatieres

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

// Profondeur d'un noeud dans la hiérarchie (0 = matière, 1 = sous-matière, 2 = cours),
// calculée en remontant les parent_id. byId : table id -> ligne matières.
export function calculerProfondeur(matiere, byId) {
  let profondeur = 0
  let courant = matiere
  while (courant?.parent_id) {
    profondeur++
    courant = byId[courant.parent_id]
    if (!courant) break
  }
  return profondeur
}

// Construit l'arbre à 3 niveaux (matière -> sous-matière -> cours) pour la page Organisation.
// Filtre les racines (matières de premier niveau) sur la période si fournie ; leurs
// descendants sont inclus quelle que soit leur propre année/semestre. Chaque noeud reçoit
// "enfants" (tableau, éventuellement vide) et "couleurEffective" (toujours celle de la racine,
// jamais celle d'un noeud intermédiaire).
export async function getArbreMatieres({ annee, semestre } = {}) {
  const { data, error } = await supabase.from('matieres').select('*').eq('archive', false).order('ordre_affichage')
  if (error) throw error

  const enfantsParParent = {}
  data.forEach((m) => {
    if (!m.parent_id) return
    if (!enfantsParParent[m.parent_id]) enfantsParParent[m.parent_id] = []
    enfantsParParent[m.parent_id].push(m)
  })

  function construire(noeud, couleurEffective) {
    const enfants = (enfantsParParent[noeud.id] || []).map((e) => construire(e, couleurEffective))
    return { ...noeud, enfants, couleurEffective }
  }

  const racines = data.filter((m) => !m.parent_id)
  const racinesFiltrees = racines.filter((m) => (!annee || m.annee === annee) && (!semestre || m.semestre === semestre))

  return racinesFiltrees.map((r) => construire(r, r.couleur || `var(--${r.type})`))
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

// Un noeud est un "cours" (feuille, porte une progression) à profondeur 2 toujours (niveau
// maximal de la hiérarchie), jamais à profondeur 0 (une matière). À profondeur 1, c'est le
// champ explicite `est_cours` qui tranche (une matière peut avoir directement des cours, ou
// une couche de sous-matières) — avec repli sur l'ancienne heuristique (pas d'enfant = cours)
// pour les lignes créées avant l'ajout de cette colonne et pas encore corrigées.
export function estCoursNoeud(noeud, profondeur) {
  if (profondeur === 0) return false
  if (profondeur >= 2) return true
  if (typeof noeud.est_cours === 'boolean') return noeud.est_cours
  return !(noeud.enfants && noeud.enfants.length > 0)
}

// Une sous-matière/matière est validée quand tous ses enfants le sont (récursif) ; un cours
// est validé à progression 100. Jamais stocké, toujours recalculé à l'affichage.
export function estValideNoeud(noeud, profondeur) {
  if (estCoursNoeud(noeud, profondeur)) return noeud.progression === 100
  if (!noeud.enfants || noeud.enfants.length === 0) return false
  return noeud.enfants.every((e) => estValideNoeud(e, profondeur + 1))
}

// Enfants directs d'une matière, partitionnés entre vraies sous-matières (branches) et cours
// directement rattachés (la matière n'a pas de couche sous-matière) — sert aux sélecteurs en
// cascade matière → [sous-matière] → cours (fiches).
export async function getEnfantsPartitionnes(matiereId) {
  const enfants = await getSousMatieres(matiereId)
  return {
    sousMatieres: enfants.filter((e) => !estCoursNoeud(e, 1)),
    coursDirects: enfants.filter((e) => estCoursNoeud(e, 1)),
  }
}

// Aplatit tous les cours d'une matière (qu'ils soient directement rattachés ou nichés sous une
// sous-matière) en une seule liste, avec un libellé de chemin pour les distinguer dans un
// sélecteur — sert aux cas cliniques et QCM, qui n'ont pas de sous_matiere en base et doivent
// donc pouvoir choisir un cours quel que soit son niveau de nichage.
// Tous les cours du site (toutes matières confondues), avec un chemin d'affichage complet —
// sert au sélecteur "déplacer vers / attacher à un cours" de la page Organisation, qui doit
// pouvoir cibler n'importe quel cours sans être limité à une matière déjà choisie.
export async function getTousLesCoursAplatis() {
  const arbre = await getArbreMatieres({})
  const resultats = []
  function parcourir(noeud, profondeur, racineNom, chemin) {
    if (estCoursNoeud(noeud, profondeur)) {
      resultats.push({ id: noeud.id, nom: noeud.nom, racine: racineNom, chemin: [...chemin, noeud.nom].join(' › ') })
    } else {
      ;(noeud.enfants || []).forEach((e) => parcourir(e, profondeur + 1, racineNom, [...chemin, noeud.nom]))
    }
  }
  arbre.forEach((r) => parcourir(r, 0, r.nom, []))
  return resultats
}

export async function getCoursAplatis(nomMatiere) {
  const matiereId = await getMatiereIdParNom(nomMatiere)
  if (!matiereId) return []
  const { sousMatieres, coursDirects } = await getEnfantsPartitionnes(matiereId)
  const groupes = await Promise.all(
    sousMatieres.map(async (s) => (await getSousMatieres(s.id)).map((c) => ({ nom: c.nom, chemin: `${s.nom} › ${c.nom}` })))
  )
  return [...coursDirects.map((c) => ({ nom: c.nom, chemin: c.nom })), ...groupes.flat()]
}
