import { supabase } from './supabase.js'
import { prochainEtatSrs } from './edn-srs.js'
import { getEtatSrs, ecrireEtatSrs } from './edn-srs-data.js'
import { getNumerosPrioritaires } from './r2c.js'

// Tentatives EDN (§4.3) — append-only, id généré côté client (crypto.randomUUID(), voir §8 lot 8
// pour l'idempotence hors-ligne). `cible` = 'q:<id>' pour une question isolée, 'd:<id>' pour un
// dossier entier (unité de révision, voir §4.3 "on ne révise pas une question de DP hors de son
// dossier").
export async function enregistrerTentative({ cible, mode, reponses, score, scoreMax, detail, dureeS, tagsErreur, itemsNumeros }) {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('edn_tentatives').insert({
    id,
    cible,
    mode,
    reponses,
    score,
    score_max: scoreMax,
    detail: detail ?? null,
    duree_s: dureeS ?? null,
    tags_erreur: tagsErreur || [],
    date_tentative: new Date().toISOString(),
  })
  if (error) throw error

  // Met à jour le SRS après CHAQUE tentative (§7.1, "le mode flash met aussi à jour le SRS" — rien
  // n'exclut le mode examen non plus). Ne bloque jamais l'enregistrement de la tentative
  // elle-même : une panne du SRS ne doit pas faire perdre la tentative déjà écrite.
  try {
    const [etatActuel, prioritaires] = await Promise.all([
      getEtatSrs(cible),
      itemsNumeros && itemsNumeros.length ? getNumerosPrioritaires() : Promise.resolve(new Set()),
    ])
    const prioritaire = (itemsNumeros || []).some((n) => prioritaires.has(n))
    const scoreNormalise = scoreMax > 0 ? score / scoreMax : 0
    const nouvelEtat = prochainEtatSrs({
      etapeActuelle: etatActuel ? etatActuel.etape : -1,
      reussitesParfaitesConsecutives: etatActuel ? etatActuel.reussites_parfaites_consecutives : 0,
      scoreNormalise,
      prioritaire,
    })
    await ecrireEtatSrs(cible, nouvelEtat, etatActuel?.suspendue || false)
  } catch (err) {
    console.error('Erreur mise à jour SRS', err)
  }

  return id
}

export function cibleQuestion(id) {
  return `q:${id}`
}

export function cibleDossier(id) {
  return `d:${id}`
}

// Historique COMPLET (§8 lot 7, page Stats) — à ne jamais confondre avec
// lib/edn-carnet.js::getTentativesEdnARevoir(), qui ne garde que la plus récente par cible.
export async function getToutesLesTentativesEdn() {
  const { data, error } = await supabase.from('edn_tentatives').select('*').order('date_tentative', { ascending: true })
  if (error) throw error
  return data
}
