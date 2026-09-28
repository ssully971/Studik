import { supabase } from './supabase.js'
import { paginerTout } from './supabase-paginate.js'

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

// Toutes les lignes SRS, brutes (tableau) — utilisée par getTousLesEtatsSrs (Banque, voir
// ci-dessous) et par la sauvegarde de Paramètres, qui a besoin du tableau, pas de la map.
export async function getTousLesEtatsSrsRaw() {
  return paginerTout(() => supabase.from('edn_srs').select('*').order('cible'))
}

// Même chose en map cible -> ligne : sert à afficher l'état "suspendue" dans la Banque sans une
// requête par ligne (§7.3).
export async function getTousLesEtatsSrs() {
  const data = await getTousLesEtatsSrsRaw()
  const map = {}
  data.forEach((r) => {
    map[r.cible] = r
  })
  return map
}

// Restauration de sauvegarde (§ Paramètres) : upsert direct, tel quel — l'état SRS restauré
// n'est jamais recalculé (§7.1 : la répétition espacée reprend exactement où la sauvegarde
// l'a laissée).
export async function restaurerEtatsSrs(etats) {
  if (!etats || etats.length === 0) return
  const { error } = await supabase.from('edn_srs').upsert(etats, { onConflict: 'cible' })
  if (error) throw error
}

export async function suspendreCible(cible, suspendue) {
  const { error } = await supabase.from('edn_srs').upsert({ cible, suspendue }, { onConflict: 'cible' })
  if (error) throw error
}

// Toutes les lignes SRS non suspendues dont la prochaine révision est arrivée (§7.1) — le tri par
// priorité/retard et le plafond se font ensuite avec selectionnerCiblesDues (fonction pure).
export async function getCiblesDues(maintenant = new Date()) {
  return paginerTout(() =>
    supabase
      .from('edn_srs')
      .select('cible, prochaine_revision')
      .eq('suspendue', false)
      .lte('prochaine_revision', maintenant.toISOString().slice(0, 10))
      .order('cible')
  )
}
