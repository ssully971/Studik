import { supabase } from './supabase.js'
import { paginerTout, requeteParLots } from './supabase-paginate.js'

// Carnet d'erreurs externat (§7.4) : dérivé de edn_tentatives (append-only, jamais de colonne
// "a_revoir" — la spec n'en prévoit pas, §4.3 : "seuls les tags d'erreur peuvent être ajoutés").
// Une cible est "à revoir" tant que sa tentative la plus récente est imparfaite ; une nouvelle
// tentative réussie la fait naturellement disparaître de cette liste, sans mutation d'aucune
// ligne existante.
export async function getTentativesEdnARevoir() {
  const data = await paginerTout(() =>
    supabase.from('edn_tentatives').select('*').order('date_tentative', { ascending: false }).order('id', { ascending: false })
  )

  const vus = new Set()
  const resultat = []
  data.forEach((t) => {
    if (vus.has(t.cible)) return
    vus.add(t.cible)
    if (t.score < t.score_max) resultat.push(t)
  })
  return resultat
}

// Résout chaque cible ('q:<id>' / 'd:<id>') vers ses métadonnées d'affichage (énoncé/titre,
// format, spécialités, items, tags), en deux requêtes groupées plutôt qu'une par tentative.
export async function resoudreCiblesEnDetail(tentatives) {
  const idsQuestions = tentatives.filter((t) => t.cible.startsWith('q:')).map((t) => t.cible.slice(2))
  const idsDossiers = tentatives.filter((t) => t.cible.startsWith('d:')).map((t) => t.cible.slice(2))

  // Découpé par lots de 200 (voir lib/supabase-paginate.js) : le nombre de cibles distinctes
  // suit la taille du carnet d'erreurs, qui peut dépasser la limite d'URL d'un .in() unique.
  const [questions, dossiers] = await Promise.all([
    requeteParLots(idsQuestions, (lot) =>
      supabase.from('edn_questions').select('id, enonce, format, specialites, items, tags, contenu, explication').in('id', lot)
    ),
    requeteParLots(idsDossiers, (lot) => supabase.from('edn_dossiers').select('id, titre, type, specialites, items, tags').in('id', lot)),
  ])

  const map = {}
  questions.forEach((q) => {
    map[`q:${q.id}`] = { ...q, sorte: 'question', titreAffiche: q.enonce, format: q.format }
  })
  dossiers.forEach((d) => {
    map[`d:${d.id}`] = { ...d, sorte: 'dossier', titreAffiche: d.titre, format: d.type }
  })
  return map
}
