import { supabase } from './supabase.js'

// Accès aux données du SRS (table edn_srs) — le calcul lui-même (paliers, plafond) est pur et vit
// dans lib/edn-srs.js. Séparé pour rester testable sans supabase.

export async function getEtatSrs(cible) {
  const { data, error } = await supabase.from('edn_srs').select('*').eq('cible', cible).maybeSingle()
  if (error) throw error
  return data
}

export async function ecrireEtatSrs(cible, nouvelEtat, suspendue) {
  const { error } = await supabase.from('edn_srs').upsert(
    {
      cible,
      etape: nouvelEtat.etape,
      prochaine_revision: nouvelEtat.prochaineRevision.toISOString().slice(0, 10),
      reussites_parfaites_consecutives: nouvelEtat.reussitesParfaitesConsecutives,
      derniere_revision: nouvelEtat.derniereRevision.toISOString(),
      suspendue: Boolean(suspendue),
    },
    { onConflict: 'cible' }
  )
  if (error) throw error
}

// Toutes les lignes SRS en une fois (map cible -> ligne) : sert à afficher l'état "suspendue"
// dans la Banque sans une requête par ligne (§7.3).
export async function getTousLesEtatsSrs() {
  const { data, error } = await supabase.from('edn_srs').select('*')
  if (error) throw error
  const map = {}
  data.forEach((r) => {
    map[r.cible] = r
  })
  return map
}

export async function suspendreCible(cible, suspendue) {
  const { error } = await supabase.from('edn_srs').upsert({ cible, suspendue }, { onConflict: 'cible' })
  if (error) throw error
}

// Toutes les lignes SRS non suspendues dont la prochaine révision est arrivée (§7.1) — le tri par
// priorité/retard et le plafond se font ensuite avec selectionnerCiblesDues (fonction pure).
export async function getCiblesDues(maintenant = new Date()) {
  const { data, error } = await supabase
    .from('edn_srs')
    .select('cible, prochaine_revision')
    .eq('suspendue', false)
    .lte('prochaine_revision', maintenant.toISOString().slice(0, 10))
  if (error) throw error
  return data
}
