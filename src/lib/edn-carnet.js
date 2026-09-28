import { supabase } from './supabase.js'

// Carnet d'erreurs externat (§7.4) : dérivé de edn_tentatives (append-only, jamais de colonne
// "a_revoir" — la spec n'en prévoit pas, §4.3 : "seuls les tags d'erreur peuvent être ajoutés").
// Une cible est "à revoir" tant que sa tentative la plus récente est imparfaite ; une nouvelle
// tentative réussie la fait naturellement disparaître de cette liste, sans mutation d'aucune
// ligne existante.
export async function getTentativesEdnARevoir() {
  const { data, error } = await supabase.from('edn_tentatives').select('*').order('date_tentative', { ascending: false })
  if (error) throw error

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

  const [questionsRes, dossiersRes] = await Promise.all([
    idsQuestions.length
      ? supabase.from('edn_questions').select('id, enonce, format, specialites, items, tags')
      : Promise.resolve({ data: [] }),
    idsDossiers.length ? supabase.from('edn_dossiers').select('id, titre, type, specialites, items, tags') : Promise.resolve({ data: [] }),
  ])

  const map = {}
  ;(questionsRes.data || []).forEach((q) => {
    map[`q:${q.id}`] = { ...q, sorte: 'question', titreAffiche: q.enonce, format: q.format }
  })
  ;(dossiersRes.data || []).forEach((d) => {
    map[`d:${d.id}`] = { ...d, sorte: 'dossier', titreAffiche: d.titre, format: d.type }
  })
  return map
}
