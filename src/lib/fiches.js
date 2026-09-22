import { supabase } from './supabase.js'
import { getMatieres } from './matieres.js'
import { upsertPartiel } from './upsert.js'

// `periodes`, si fourni (tableau de {annee, semestre}), prime sur `annee`/`semestre` et est
// traité comme une UNION de périodes (utilisé quand un tag scopé sur plusieurs périodes est
// sélectionné dans un filtre). Renvoie null quand aucune restriction de période ne s'applique.
async function resoudreNomsMatieres({ annee, semestre, periodes }) {
  if (periodes && periodes.length > 0) {
    const listes = await Promise.all(periodes.map((p) => getMatieres({ annee: p.annee, semestre: p.semestre })))
    const noms = new Set()
    listes.forEach((liste) => liste.forEach((m) => noms.add(m.nom)))
    return Array.from(noms)
  }
  if (annee || semestre) {
    const matieres = await getMatieres({ annee, semestre })
    return matieres.map((m) => m.nom)
  }
  return null
}

export async function getFiches({ matiere, type, annee, semestre, periodes, inclureArchivees } = {}) {
  let query = supabase.from('fiches').select('*')
  if (!inclureArchivees) query = query.neq('statut', 'archive')

  if (matiere) query = query.eq('matiere', matiere)
  if (type) query = query.eq('type', type)

  const noms = await resoudreNomsMatieres({ annee, semestre, periodes })
  if (noms) {
    if (noms.length === 0) return []
    query = query.in('matiere', noms)
  }

  const { data, error } = await query.order('titre')
  if (error) throw error
  return data
}

export async function getFicheById(id) {
  const { data, error } = await supabase.from('fiches').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function insertFiches(fichesArray) {
  return upsertPartiel('fiches', fichesArray)
}

export async function updateNotesPerso(id, notesPerso) {
  const { error } = await supabase.from('fiches').update({ notes_perso: notesPerso }).eq('id', id)
  if (error) throw error
}

export async function getFichesARevoir({ matiere, type, annee, semestre, periodes } = {}) {
  let query = supabase.from('fiches').select('*').eq('statut', 'a_revoir')

  if (matiere) query = query.eq('matiere', matiere)
  if (type) query = query.eq('type', type)

  const noms = await resoudreNomsMatieres({ annee, semestre, periodes })
  if (noms) {
    if (noms.length === 0) return []
    query = query.in('matiere', noms)
  }

  const { data, error } = await query.order('titre')
  if (error) throw error
  return data
}

export async function updateStatut(id, statut) {
  const { error } = await supabase.from('fiches').update({ statut }).eq('id', id)
  if (error) throw error
}

export async function getAllFicheIds() {
  const { data, error } = await supabase.from('fiches').select('id')
  if (error) throw error
  return data.map((f) => f.id)
}

export async function getFicheCountByMatiere(nomMatiere) {
  const { count, error } = await supabase
    .from('fiches')
    .select('id', { count: 'exact', head: true })
    .eq('matiere', nomMatiere)
  if (error) throw error
  return count
}

export async function deleteAllFiches() {
  const { error } = await supabase.from('fiches').delete().not('id', 'is', null)
  if (error) throw error
}

export async function deleteFiche(id) {
  const { error } = await supabase.from('fiches').delete().eq('id', id)
  if (error) throw error
}

export async function updateFicheTags(id, tags) {
  const { error } = await supabase.from('fiches').update({ tags }).eq('id', id)
  if (error) throw error
}

export async function enregistrerRevision(id, resultat) {
  const statut = resultat === 'bien' ? 'valide' : 'a_revoir'
  const { error } = await supabase
    .from('fiches')
    .update({
      date_derniere_revision: new Date().toISOString(),
      dernier_resultat: resultat,
      statut,
    })
    .eq('id', id)
  if (error) throw error
}

export async function updateFicheLiens(id, champs) {
  const { error } = await supabase.from('fiches').update(champs).eq('id', id)
  if (error) throw error
}

export async function updateFiche(id, champs) {
  const { error } = await supabase.from('fiches').update(champs).eq('id', id)
  if (error) throw error
}

export function texteRechercheFiche(fiche) {
  const valeursContenu = Object.values(fiche.contenu_structure || {}).flat()
  return [fiche.titre, ...(fiche.tags || []), ...(fiche.synonymes || []), ...(fiche.pathologies_associees || []), ...valeursContenu]
    .join(' ')
    .toLowerCase()
}

export async function getAllFichesRaw() {
  const { data, error } = await supabase.from('fiches').select('*')
  if (error) throw error
  return data
}

// --- Cascade de renommage (Organisation) : quand une matière/sous-matière/cours est
// renommé(e), le contenu qui le référence par nom (pas par id) doit suivre, sinon il devient
// invisible partout (bug déjà rencontré : contenu "perdu" après renommage d'une matière).

export async function renommerMatiereFiches(ancienNom, nouveauNom) {
  const { error } = await supabase.from('fiches').update({ matiere: nouveauNom }).eq('matiere', ancienNom)
  if (error) throw error
}

export async function renommerSousMatiereFiches(nomMatiere, ancienNom, nouveauNom) {
  const { error } = await supabase.from('fiches').update({ sous_matiere: nouveauNom }).eq('matiere', nomMatiere).eq('sous_matiere', ancienNom)
  if (error) throw error
}

// sousMatiere = null pour un cours directement rattaché à la matière (pas de couche
// sous-matière au-dessus).
export async function renommerCoursFiches(nomMatiere, sousMatiere, ancienNom, nouveauNom) {
  let query = supabase.from('fiches').update({ cours: nouveauNom }).eq('matiere', nomMatiere).eq('cours', ancienNom)
  query = sousMatiere ? query.eq('sous_matiere', sousMatiere) : query.is('sous_matiere', null)
  const { error } = await query
  if (error) throw error
}
