// Sauvegarde / restauration complète (Paramètres) — étendue à l'Externat sans créer un second
// système : ce module orchestre les mêmes fonctions insertX/restaurerX que celles déjà
// utilisées ailleurs (import, Banque...), dans l'ordre déduit des vraies clés étrangères des
// migrations (parents avant enfants). Une restauration n'est PAS atomique (pas de fonction
// Postgres dédiée, upsert partiel séquentiel comme le reste du projet) : `preparerRestauration`
// fait donc un préflight complet (structure + références résolubles) AVANT toute écriture, et
// `restaurerSauvegarde` nomme la table en échec si une étape échoue malgré tout — la
// restauration entière peut être relancée sans risque depuis le même fichier (upsert par id,
// rien n'est dupliqué).
import { getAllFichesRaw, insertFiches } from './fiches.js'
import { getAllCas, insertCas, getAllTentativesRaw, restaurerTentatives } from './cas.js'
import { getAllMatieresAvecSousMatieres, insertMatieres, getAllMatiereIds } from './matieres.js'
import { getAllCaptures, restaurerCaptures } from './captures.js'
import { getAllQcmRaw, insertQcm, getAllQcmTentativesRaw, restaurerTentativesQcm } from './qcm.js'
import { getCheckins, restaurerCheckins } from './checkins.js'
import { getTagsAvecPerimetre, restaurerTags } from './tags.js'
import { getR2cItems, getR2cSdd, restaurerR2cItems, restaurerR2cSdd } from './r2c.js'
import { getConstantes, restaurerConstantes } from './constantes-bio.js'
import { getAllDossiers, getAllQuestionsRaw, getAllDossierIds, restaurerDossiers, restaurerQuestions } from './edn-content.js'
import { getToutesLesTentativesEdn, restaurerTentativesEdn } from './edn-tentatives.js'
import { getTousLesEtatsSrsRaw, restaurerEtatsSrs } from './edn-srs-data.js'
import { getStations, getAllStationIds, restaurerStations } from './ecos.js'
import { getToutesLesTentativesEcos, restaurerTentativesEcos } from './ecos-tentatives.js'
import { getTagsErreur, setTagsErreur } from './edn-tags-erreur.js'
import { lirePreference, ecrirePreference } from './preferences.js'
import { compterTentativesEnAttente } from './offline-queue.js'
import { estTableAbsente } from './externat-schema.js'

// v1 = format historique (P2 seul, pas de champ `version`) ; v2 = ajoute la section `externat`
// et les préférences Externat. Un fichier sans `version` est TOUJOURS traité comme v1, quelle
// que soit la version courante de ce module.
export const VERSION_SAUVEGARDE = 2

// --- Export -----------------------------------------------------------------------------

// Ne renvoie null que si la migration 001 n'a pas été appliquée : dans ce cas la sauvegarde
// P2 reste possible, la section Externat est simplement absente (jamais une sauvegarde qui
// échoue entièrement parce que l'Externat n'a jamais été configuré).
async function recupererDonneesExternat() {
  try {
    const [r2cItems, r2cSdd, constantesBio, dossiers, questions, tentativesEdn, etatsSrs, stations, tentativesEcos, cycle, plafond, tagsErreur] =
      await Promise.all([
        getR2cItems(),
        getR2cSdd(),
        getConstantes(),
        getAllDossiers(),
        getAllQuestionsRaw(),
        getToutesLesTentativesEdn(),
        getTousLesEtatsSrsRaw(),
        getStations(),
        getToutesLesTentativesEcos(),
        lirePreference('cycle'),
        lirePreference('edn_plafond_revisions'),
        lirePreference('edn_tags_erreur'),
      ])
    return {
      r2c_items: r2cItems,
      r2c_sdd: r2cSdd,
      constantes_bio: constantesBio,
      edn_dossiers: dossiers,
      edn_questions: questions,
      edn_tentatives: tentativesEdn,
      edn_srs: etatsSrs,
      ecos_stations: stations,
      ecos_tentatives: tentativesEcos,
      preferences: { cycle: cycle ?? null, plafond_revisions: plafond ?? null, tags_erreur: tagsErreur ?? null },
    }
  } catch (err) {
    if (estTableAbsente(err)) return null
    throw err
  }
}

// Renvoie { backup, nombreTentativesEnAttente } : le nombre de tentatives EDN/ECOS encore dans
// la file hors-ligne (IndexedDB) au moment de l'export — pas encore en base, donc absentes du
// fichier, l'appelant décide comment prévenir (voir Paramètres).
export async function exporterSauvegarde() {
  const [fiches, cas, qcm, matieres, tentatives, tentativesQcm, captures, checkins, tags, externat, nombreTentativesEnAttente] = await Promise.all([
    getAllFichesRaw(),
    getAllCas(),
    getAllQcmRaw(),
    getAllMatieresAvecSousMatieres(),
    getAllTentativesRaw(),
    getAllQcmTentativesRaw(),
    getAllCaptures(),
    getCheckins(),
    getTagsAvecPerimetre(),
    recupererDonneesExternat(),
    compterTentativesEnAttente().catch(() => 0),
  ])

  const backup = {
    version: VERSION_SAUVEGARDE,
    exported_at: new Date().toISOString(),
    fiches,
    cas,
    qcm,
    matieres,
    tentatives,
    tentativesQcm,
    captures,
    checkins,
    tags,
  }
  if (externat) backup.externat = externat

  return { backup, nombreTentativesEnAttente }
}

// --- Préflight ----------------------------------------------------------------------------

const SECTIONS_TABLEAU_P2 = ['fiches', 'cas', 'qcm', 'matieres', 'tentatives', 'tentativesQcm', 'captures', 'checkins', 'tags']
const SECTIONS_TABLEAU_EXTERNAT = [
  'r2c_items',
  'r2c_sdd',
  'constantes_bio',
  'edn_dossiers',
  'edn_questions',
  'edn_tentatives',
  'edn_srs',
  'ecos_stations',
  'ecos_tentatives',
]

// Fonctions pures (aucun accès réseau) — testables isolément.

export function validerStructure(data) {
  const erreurs = []
  if (!data || typeof data !== 'object') return ['Le fichier ne contient pas un objet JSON valide.']

  SECTIONS_TABLEAU_P2.forEach((cle) => {
    if (data[cle] !== undefined && !Array.isArray(data[cle])) erreurs.push(`"${cle}" doit être un tableau.`)
  })

  if (data.externat !== undefined) {
    if (typeof data.externat !== 'object' || data.externat === null) {
      erreurs.push('"externat" doit être un objet.')
    } else {
      SECTIONS_TABLEAU_EXTERNAT.forEach((cle) => {
        if (data.externat[cle] !== undefined && !Array.isArray(data.externat[cle])) erreurs.push(`"externat.${cle}" doit être un tableau.`)
      })
    }
  }
  return erreurs
}

// Une matière dont `parent_id` ne résout ni dans le fichier ni en base ferait échouer
// insertMatieres avec une erreur de contrainte de clé étrangère brute — message clair à la place.
export function validerReferencesMatieres(matieres, idsExistants = []) {
  if (!matieres || matieres.length === 0) return []
  const connus = new Set([...matieres.map((m) => m.id), ...idsExistants])
  return matieres.filter((m) => m.parent_id && !connus.has(m.parent_id)).map((m) => `Matière "${m.id}" référence un parent "${m.parent_id}" introuvable dans le fichier ou en base.`)
}

// `edn_questions.dossier_id` et `ecos_tentatives.station_id` sont de vraies contraintes de clé
// étrangère (supabase/migrations/001_externat_fondations.sql) — même principe que les matières.
export function validerReferencesExternat(externat, idsDossiersExistants = [], idsStationsExistants = []) {
  if (!externat) return []
  const erreurs = []
  const dossiersConnus = new Set([...(externat.edn_dossiers || []).map((d) => d.id), ...idsDossiersExistants])
  const stationsConnues = new Set([...(externat.ecos_stations || []).map((s) => s.id), ...idsStationsExistants])

  ;(externat.edn_questions || []).forEach((q) => {
    if (q.dossier_id && !dossiersConnus.has(q.dossier_id)) {
      erreurs.push(`Question "${q.id}" référence le dossier "${q.dossier_id}", introuvable dans le fichier ou en base.`)
    }
  })
  ;(externat.ecos_tentatives || []).forEach((t) => {
    if (t.station_id && !stationsConnues.has(t.station_id)) {
      erreurs.push(`Tentative ECOS "${t.id}" référence la station "${t.station_id}", introuvable dans le fichier ou en base.`)
    }
  })
  return erreurs
}

function externatAUneLigne(externat) {
  return Boolean(externat) && SECTIONS_TABLEAU_EXTERNAT.some((cle) => (externat[cle] || []).length > 0)
}

// Orchestration (accès réseau) : structure, puis résolvabilité des références contre le fichier
// ET la base. `{ ok: true }` ou `{ ok: false, erreurs }` — n'écrit jamais rien.
export async function preparerRestauration(data) {
  const erreursStructure = validerStructure(data)
  if (erreursStructure.length > 0) return { ok: false, erreurs: erreursStructure }

  const erreurs = []

  if (data.matieres?.length) {
    const idsExistants = await getAllMatiereIds().catch(() => [])
    erreurs.push(...validerReferencesMatieres(data.matieres, idsExistants))
  }

  if (data.version && data.externat) {
    if (externatAUneLigne(data.externat)) {
      try {
        const [idsDossiers, idsStations] = await Promise.all([getAllDossierIds(), getAllStationIds()])
        erreurs.push(...validerReferencesExternat(data.externat, idsDossiers, idsStations))
      } catch (err) {
        if (estTableAbsente(err)) {
          erreurs.push('Ce fichier contient des données Externat mais la migration 001 n\'est pas appliquée sur cette base — applique-la (voir docs/externat/A-FAIRE-SULLIVAN.md) avant de restaurer.')
        } else {
          throw err
        }
      }
    }
  }

  return erreurs.length > 0 ? { ok: false, erreurs } : { ok: true }
}

// --- Restauration -------------------------------------------------------------------------

// Comportement HISTORIQUE, inchangé à la ligne près : un fichier sans `version` (toute
// sauvegarde faite avant l'ajout de l'Externat) se restaure exactement comme avant, y compris
// ses limites connues (voir lib/cas.js::restaurerTentatives).
async function restaurerLegacy(data) {
  if (data.matieres?.length) await insertMatieres(trierMatieresParProfondeur(data.matieres))
  if (data.fiches?.length) await insertFiches(data.fiches)
  if (data.cas?.length) await insertCas(data.cas)
  if (data.qcm?.length) await insertQcm(data.qcm)
  if (data.tentatives?.length) await restaurerTentatives(data.tentatives)
  if (data.tentativesQcm?.length) await restaurerTentativesQcm(data.tentativesQcm)
  if (data.captures?.length) await restaurerCaptures(data.captures)
  if (data.checkins?.length) await restaurerCheckins(data.checkins)
  if (data.tags?.length) await restaurerTags(data.tags)
}

// Insère les matières parents avant leurs enfants (parent_id référence une autre ligne de la
// même table) : un ordre quelconque ferait échouer la contrainte de clé étrangère.
export function trierMatieresParProfondeur(matieres) {
  const byId = {}
  matieres.forEach((m) => {
    byId[m.id] = m
  })
  function profondeur(m) {
    let p = 0
    let courant = m
    while (courant?.parent_id) {
      p++
      courant = byId[courant.parent_id]
      if (!courant) break
    }
    return p
  }
  return [...matieres].sort((a, b) => profondeur(a) - profondeur(b))
}

// Ordre déduit des vraies contraintes de clé étrangère des migrations : dossiers avant
// questions (edn_questions.dossier_id), stations avant tentatives ECOS
// (ecos_tentatives.station_id). Le reste (r2c_*, constantes_bio, edn_tentatives, edn_srs) n'a
// aucune contrainte réelle entre ces tables — ordre sans conséquence, gardé lisible.
const ETAPES_EXTERNAT = [
  ['r2c_items', restaurerR2cItems],
  ['r2c_sdd', restaurerR2cSdd],
  ['constantes_bio', restaurerConstantes],
  ['edn_dossiers', restaurerDossiers],
  ['edn_questions', restaurerQuestions],
  ['edn_tentatives', restaurerTentativesEdn],
  ['edn_srs', restaurerEtatsSrs],
  ['ecos_stations', restaurerStations],
  ['ecos_tentatives', restaurerTentativesEcos],
]

async function restaurerPreferencesExternat(preferences) {
  if (!preferences) return
  // N'écrit que ce qui a une vraie valeur sauvegardée — jamais un défaut applicatif qui
  // écraserait une préférence existante sur la base cible (voir getPlafondRevisions/
  // getTagsErreur, qui renvoient un défaut quand la préférence n'a jamais été écrite : ce
  // défaut ne doit jamais être confondu avec une valeur réellement sauvegardée).
  if (preferences.cycle != null) await ecrirePreference('cycle', preferences.cycle)
  if (preferences.plafond_revisions != null) await ecrirePreference('edn_plafond_revisions', preferences.plafond_revisions)
  if (preferences.tags_erreur != null) await setTagsErreur(preferences.tags_erreur)
}

// `onEtape(cle)` est appelée juste avant chaque étape non vide (progression affichable). En cas
// d'échec, l'erreur nomme la table en cause — la restauration entière peut être relancée depuis
// le même fichier sans risque (upsert par id, rien n'est dupliqué ni perdu).
export async function restaurerSauvegarde(data, { onEtape } = {}) {
  if (!data.version) {
    return restaurerLegacy(data)
  }

  const etapesP2 = [
    ['matieres', (rows) => insertMatieres(trierMatieresParProfondeur(rows))],
    ['fiches', insertFiches],
    ['cas', insertCas],
    ['qcm', insertQcm],
    ['tentatives', restaurerTentatives],
    ['tentativesQcm', restaurerTentativesQcm],
    ['captures', restaurerCaptures],
    ['checkins', restaurerCheckins],
    ['tags', restaurerTags],
  ]

  for (const [cle, fn] of etapesP2) {
    const rows = data[cle]
    if (!rows || rows.length === 0) continue
    onEtape?.(cle)
    try {
      await fn(rows)
    } catch (err) {
      throw new Error(
        `Restauration interrompue à l'étape "${cle}" : ${err.message}. Rien n'est perdu : corrige le problème puis relance la restauration depuis ce même fichier, elle peut être rejouée entièrement sans risque (upsert par id).`
      )
    }
  }

  if (data.externat) {
    for (const [cle, fn] of ETAPES_EXTERNAT) {
      const rows = data.externat[cle]
      if (!rows || rows.length === 0) continue
      onEtape?.(cle)
      try {
        await fn(rows)
      } catch (err) {
        throw new Error(
          `Restauration interrompue à l'étape "externat.${cle}" : ${err.message}. Rien n'est perdu : corrige le problème puis relance la restauration depuis ce même fichier, elle peut être rejouée entièrement sans risque (upsert par id).`
        )
      }
    }
    onEtape?.('externat.preferences')
    try {
      await restaurerPreferencesExternat(data.externat.preferences)
    } catch (err) {
      throw new Error(`Restauration interrompue à l'étape "externat.preferences" : ${err.message}. Relance la restauration depuis ce même fichier.`)
    }
  }
}
