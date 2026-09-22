// Vérifie, sans authentification, que chaque table Supabase refuse bien l'accès au rôle
// "anon" (clé publique seule, aucun jeton de session). Ne lit, n'écrit ni ne supprime aucune
// donnée réelle : un rejet (401/403) est le résultat attendu et recherché.
//
// Usage : node scripts/audit-rls.mjs

const SUPABASE_URL = 'https://pgcjhafcwtreobzrzajs.supabase.co'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2poYWZjd3RyZW9ienJ6YWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDI0NzQsImV4cCI6MjEwNDcxODQ3NH0.Hy-a0GnKgL5ZWZ5G8zPtFfAl0avZXl2SY4P6V7Ikpyw'

const TABLES = [
  'matieres',
  'fiches',
  'cas_cliniques',
  'qcm',
  'tentatives',
  'qcm_tentatives',
  'tags_reference',
  'checkins',
  'captures',
  'contenu_cours',
]

async function checkTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: ANON_KEY },
  })
  const body = await res.json().catch(() => null)
  const bloque = res.status === 401 || res.status === 403
  const tableAbsente = res.status === 404
  return { table, status: res.status, bloque, tableAbsente, errCode: body?.code }
}

const resultats = await Promise.all(TABLES.map(checkTable))

let echecs = 0
for (const r of resultats) {
  if (r.tableAbsente) {
    console.log(`⚠  ${r.table.padEnd(16)} table absente (404) — migration non appliquée, à ignorer si attendu`)
    continue
  }
  if (r.bloque) {
    console.log(`✅ ${r.table.padEnd(16)} accès anonyme refusé (${r.status})`)
  } else {
    echecs++
    console.log(`❌ ${r.table.padEnd(16)} ACCÈS ANONYME NON REFUSÉ (status ${r.status}) — à corriger d'urgence`)
  }
}

console.log('')
if (echecs === 0) {
  console.log('Toutes les tables testées refusent l\'accès anonyme (lecture non authentifiée).')
  console.log('Rappel : ce test ne vérifie PAS si un compte authentifié quelconque (autre que le tien)')
  console.log('aurait accès aux données — cela dépend de la politique RLS exacte et des réglages')
  console.log('d\'inscription publique dans le tableau de bord Supabase (voir rapport).')
} else {
  console.log(`${echecs} table(s) accessible(s) sans authentification — vérifier les policies RLS immédiatement.`)
  process.exitCode = 1
}
