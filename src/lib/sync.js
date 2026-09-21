import { getAllFichesRaw } from './fiches.js'
import { getAllCas } from './cas.js'
import { getAllQcmRaw } from './qcm.js'
import { getAllMatieresAvecSousMatieres, insertMatieres } from './matieres.js'
import { getTags, ajouterTag } from './tags.js'
import { slugify } from './slug.js'

// Scanne fiches/cas/QCM et corrige les incohérences automatiquement (créations uniquement,
// jamais de suppression) : matières manquantes, sous-matières manquantes, tags manquants.
export async function synchroniserDonnees() {
  const [fiches, cas, qcm, matieresExistantes, tagsExistants] = await Promise.all([
    getAllFichesRaw(),
    getAllCas(),
    getAllQcmRaw(),
    getAllMatieresAvecSousMatieres(),
    getTags(),
  ])

  const nomsMatieresExistantes = new Set(matieresExistantes.map((m) => m.nom))
  // Clé par id (slug) plutôt que par nom exact : deux noms qui se slugifient à l'identique
  // (accents/casse différents) désignent la même ligne réelle. Les traiter comme "manquants"
  // sur leur nom exact provoquerait un upsert qui écraserait le nom déjà en base.
  const idsMatieresExistants = new Set(matieresExistantes.map((m) => m.id))
  const idParNomParent = {}
  matieresExistantes.forEach((m) => {
    if (!m.parent_id) idParNomParent[m.nom] = m.id
  })

  // --- Matières manquantes (fiches, cas, QCM) ---
  const matieresACreer = new Map()
  function considererMatiere(nom, type) {
    if (!nom) return
    if (nomsMatieresExistantes.has(nom)) return
    const id = slugify(nom)
    if (idsMatieresExistants.has(id) || matieresACreer.has(id)) return
    matieresACreer.set(id, { id, nom, type, couleur: null, ordre_affichage: 0, annee: null, semestre: null })
  }
  fiches.forEach((f) => considererMatiere(f.matiere, f.type))
  cas.forEach((c) => considererMatiere(c.matiere, c.type))
  qcm.forEach((q) => (q.matieres || []).forEach((m) => considererMatiere(m, 'clinique')))

  if (matieresACreer.size > 0) {
    await insertMatieres(Array.from(matieresACreer.values()))
    matieresACreer.forEach((m) => {
      idParNomParent[m.nom] = m.id
      nomsMatieresExistantes.add(m.nom)
      idsMatieresExistants.add(m.id)
    })
  }

  // --- Sous-matières manquantes (fiches uniquement) ---
  const sousMatieresACreer = new Map()
  fiches.forEach((f) => {
    if (!f.sous_matiere) return
    if (nomsMatieresExistantes.has(f.sous_matiere)) return
    const id = slugify(f.sous_matiere)
    if (idsMatieresExistants.has(id) || sousMatieresACreer.has(id)) return
    const parentId = idParNomParent[f.matiere]
    if (!parentId) return
    sousMatieresACreer.set(id, {
      id,
      nom: f.sous_matiere,
      type: f.type,
      couleur: null,
      ordre_affichage: 0,
      annee: null,
      semestre: null,
      parent_id: parentId,
    })
  })

  if (sousMatieresACreer.size > 0) {
    await insertMatieres(Array.from(sousMatieresACreer.values()))
  }

  // --- Tags manquants (fiches, cas, QCM) ---
  const tagsConnus = new Set(tagsExistants)
  const tagsACreer = new Set()
  ;[...fiches, ...cas, ...qcm].forEach((item) => {
    ;(item.tags || []).forEach((t) => {
      if (!tagsConnus.has(t)) tagsACreer.add(t)
    })
  })

  for (const t of tagsACreer) {
    await ajouterTag(t)
    tagsConnus.add(t)
  }

  return {
    matieresCreees: Array.from(matieresACreer.values()).map((m) => m.nom),
    sousMatieresCreees: Array.from(sousMatieresACreer.values()).map((m) => m.nom),
    tagsCrees: Array.from(tagsACreer),
  }
}
