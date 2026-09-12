import { supabase } from './supabase.js'

const STORAGE_KEY = 'studik_periode'

export function getPeriodeActuelle() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setPeriodeActuelle(periode) {
  if (!periode) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(periode))
  }
}

export async function getPeriodesDisponibles() {
  const { data, error } = await supabase.from('matieres').select('annee, semestre')
  if (error) throw error

  const set = new Set()
  data.forEach((f) => {
    if (f.annee) set.add(JSON.stringify({ annee: f.annee, semestre: f.semestre || null }))
  })

  return Array.from(set)
    .map((s) => JSON.parse(s))
    .sort((a, b) => a.annee.localeCompare(b.annee) || (a.semestre || '').localeCompare(b.semestre || ''))
}
