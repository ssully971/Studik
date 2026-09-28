import { supabase } from './supabase.js'
import { prochainEtatSrs } from './edn-srs.js'
import { getEtatSrs, ecrireEtatSrs } from './edn-srs-data.js'
import { getNumerosPrioritaires } from './r2c.js'
import { mettreEnFile } from './offline-queue.js'

// fetch() natif rejette avec un TypeError quand la requête n'atteint jamais le serveur (pas de
// réseau, DNS...) — jamais une erreur métier/validation renvoyée PAR le serveur (celle-ci reste
// une vraie exception, pas mise en file).
function estErreurReseau(err) {
  return err instanceof TypeError
}

// Tentatives EDN (§4.3) — append-only, id généré côté client (crypto.randomUUID(), pour servir de
// clé d'idempotence à l'insert différé si mis en file hors-ligne, §8 lot 8). `cible` = 'q:<id>'
// pour une question isolée, 'd:<id>' pour un dossier entier (unité de révision, voir §4.3 "on ne
// révise pas une question de DP hors de son dossier").
export async function enregistrerTentative({ cible, mode, reponses, score, scoreMax, detail, dureeS, tagsErreur, itemsNumeros }) {
  const id = crypto.randomUUID()
  const ligne = {
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
  }

  // Hors-ligne détecté à l'avance (§8) : mise en file directe, sans même tenter la requête — le
  // recalcul SRS se fait au retour du réseau (offline-queue.js), jamais ici en incrémental sur un
  // état qu'on ne peut pas garantir à jour.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await mettreEnFile('edn_tentatives', id, ligne, { itemsNumeros })
    return id
  }

  try {
    const { error } = await supabase.from('edn_tentatives').insert(ligne)
    if (error) throw error
  } catch (err) {
    if (estErreurReseau(err)) {
      await mettreEnFile('edn_tentatives', id, ligne, { itemsNumeros })
      return id
    }
    throw err
  }

  // Met à jour le SRS après CHAQUE tentative EN LIGNE (§7.1, "le mode flash met aussi à jour le
  // SRS" — rien n'exclut le mode examen non plus). Ne bloque jamais l'enregistrement de la
  // tentative elle-même : une panne du SRS ne doit pas faire perdre la tentative déjà écrite.
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
