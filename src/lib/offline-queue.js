// File d'attente hors-ligne (§8 lot 8) — générique : elle ne connaît que "une table, une ligne à
// upserter, éventuellement des items pour le recalcul SRS", jamais la forme précise d'une
// tentative EDN ou ECOS (ça reste la responsabilité de edn-tentatives.js/ecos-tentatives.js, qui
// construisent la ligne avant de la mettre en file — évite un import circulaire avec ces modules).
import { supabase } from './supabase.js'
import { rejouerHistoriqueSrs } from './edn-srs.js'
import { getEtatSrs, ecrireEtatSrs } from './edn-srs-data.js'
import { getNumerosPrioritaires } from './r2c.js'
import {
  sauverDansMagasin,
  listerMagasin,
  supprimerDuMagasin,
  compterMagasin,
  MAGASIN_TENTATIVES_EN_ATTENTE,
} from './offline-db.js'

// Nom de l'évènement DOM émis à chaque changement de la file (ajout ou rejeu) — écouté par
// main.js pour rafraîchir l'indicatif "hors-ligne · N en attente" sans que ce module (ou
// edn-tentatives.js/ecos-tentatives.js, qui l'appellent) n'ait besoin d'importer main.js.
export const EVENEMENT_FILE_CHANGEE = 'studik:file-hors-ligne-changee'

function signalerChangement() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENEMENT_FILE_CHANGEE))
}

export async function mettreEnFile(table, id, ligne, extra = {}) {
  await sauverDansMagasin(MAGASIN_TENTATIVES_EN_ATTENTE, { id, table, ligne, itemsNumeros: extra.itemsNumeros || [], dateAjout: new Date().toISOString() })
  signalerChangement()
}

export async function compterTentativesEnAttente() {
  return compterMagasin(MAGASIN_TENTATIVES_EN_ATTENTE)
}

// Insert idempotent (§8 : "upsert avec ignoreDuplicates sur id") de chaque tentative en attente,
// puis UN SEUL recalcul SRS par cible EDN affectée (jamais un par tentative) en rejouant tout son
// historique trié par date_tentative — rien n'est perdu si le retour réseau ne survient qu'après
// plusieurs jours hors-ligne et que d'autres tentatives (en ligne, sur un autre appareil) se sont
// entre-temps ajoutées à la même cible.
export async function rejouerFileTentatives() {
  const enAttente = await listerMagasin(MAGASIN_TENTATIVES_EN_ATTENTE)
  if (enAttente.length === 0) return { rejouees: 0 }

  const itemsNumerosParCible = {}

  for (const item of enAttente) {
    const { error } = await supabase.from(item.table).upsert(item.ligne, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
    if (item.table === 'edn_tentatives') {
      itemsNumerosParCible[item.ligne.cible] = item.itemsNumeros
    }
    await supprimerDuMagasin(MAGASIN_TENTATIVES_EN_ATTENTE, item.id)
  }

  for (const cible of Object.keys(itemsNumerosParCible)) {
    await recalculerSrsPourCible(cible, itemsNumerosParCible[cible])
  }

  signalerChangement()
  return { rejouees: enAttente.length }
}

async function recalculerSrsPourCible(cible, itemsNumeros) {
  const { data, error } = await supabase
    .from('edn_tentatives')
    .select('score, score_max, date_tentative')
    .eq('cible', cible)
    .order('date_tentative', { ascending: true })
  if (error) throw error

  const prioritaires = itemsNumeros && itemsNumeros.length ? await getNumerosPrioritaires() : new Set()
  const prioritaire = (itemsNumeros || []).some((n) => prioritaires.has(n))
  const historique = data.map((t) => ({ score: t.score, scoreMax: t.score_max, dateTentative: t.date_tentative }))

  const nouvelEtat = rejouerHistoriqueSrs(historique, prioritaire)
  if (!nouvelEtat) return

  const etatActuel = await getEtatSrs(cible)
  await ecrireEtatSrs(cible, nouvelEtat, etatActuel?.suspendue || false)
}
