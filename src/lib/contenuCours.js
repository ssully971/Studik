import { supabase } from './supabase.js'

// Rattachements supplémentaires entre un contenu (fiche/cas/QCM) et un emplacement de la
// hiérarchie matières, en plus de son rattachement principal (matiere/sous_matiere/cours sur la
// ligne elle-même) — permet à un même élément d'apparaître dans plusieurs cours, sous-matières
// ou matières sans dupliquer la ligne. `cours_id` référence n'importe quel noeud de la table
// `matieres` (matière, sous-matière ou cours) : le nom de la colonne date du moment où seul un
// rattachement à un cours était possible, mais la contrainte de clé étrangère n'a jamais été
// limitée à ce niveau.

export async function getTousLesAttachements() {
  const { data, error } = await supabase.from('contenu_cours').select('*')
  if (error) throw error
  return data
}

export async function getCoursAttaches(contenuType, contenuId) {
  const { data, error } = await supabase.from('contenu_cours').select('cours_id').eq('contenu_type', contenuType).eq('contenu_id', contenuId)
  if (error) throw error
  return data.map((r) => r.cours_id)
}

export async function attacherContenu(coursId, contenuType, contenuId) {
  const { error } = await supabase.from('contenu_cours').upsert(
    { cours_id: coursId, contenu_type: contenuType, contenu_id: contenuId },
    { onConflict: 'cours_id,contenu_type,contenu_id' }
  )
  if (error) throw error
}

export async function detacherContenu(coursId, contenuType, contenuId) {
  const { error } = await supabase.from('contenu_cours').delete().eq('cours_id', coursId).eq('contenu_type', contenuType).eq('contenu_id', contenuId)
  if (error) throw error
}
