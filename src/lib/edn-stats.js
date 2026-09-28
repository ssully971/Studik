// Statistiques externat (§8 lot 7) : uniquement des fonctions pures — la page
// pages/externat/edn-stats.js s'occupe de récupérer les données (tentatives, dossiers/questions,
// stations ECOS) et d'aplatir chaque tentative en "unités évaluées" avant de les passer ici.
//
// Une "unité évaluée" = { score, scoreMax, format, rang, specialites, items, estLCA, dateTentative }
// — une par question réellement notée (une tentative de dossier est éclatée en autant d'unités
// que de questions dans son `detail`, une tentative de question isolée = une seule unité).

import { rangFormat } from './edn-format.js'

export const SEUIL_VALIDATION_AA = 14

function grouperEtSommer(unites, clefsFn) {
  const groupes = new Map()
  unites.forEach((u) => {
    const poids = u.estLCA ? 2 : 1 // §8 lot 7 : "LCA comptée double dans les statistiques"
    clefsFn(u).forEach((clef) => {
      if (clef === null || clef === undefined || clef === '') return
      if (!groupes.has(clef)) groupes.set(clef, { score: 0, scoreMax: 0 })
      const g = groupes.get(clef)
      g.score += u.score * poids
      g.scoreMax += u.scoreMax * poids
    })
  })
  return groupes
}

export function reussiteParSpecialite(unites) {
  return grouperEtSommer(unites, (u) => u.specialites || [])
}

export function reussiteParItem(unites) {
  return grouperEtSommer(unites, (u) => (u.items || []).map(String))
}

export function reussiteParFormat(unites) {
  return grouperEtSommer(unites, (u) => [u.format])
}

export function reussiteParRang(unites) {
  return grouperEtSommer(unites, (u) => [u.rang])
}

// Note AA estimée (§4.2 : "Seules les questions « double A » ... comptent pour le seuil de
// validation de 14/20") : ramenée sur 20, à partir des seules unités double-A. Respecte aussi la
// pondération LCA x2 (§8 : "LCA comptée double" — lu comme s'appliquant à toute réussite agrégée,
// pas seulement aux regroupements par spécialité/item/format/rang). `null` si aucune donnée
// double-A pour l'instant (pas de note à 0/20 trompeuse tant qu'on n'a rien à mesurer).
export function noteAAEstimee(unites) {
  const doubleA = unites.filter((u) => u.rang === 'A' && rangFormat(u.format) === 'A')
  const poids = (u) => (u.estLCA ? 2 : 1)
  const scoreMax = doubleA.reduce((a, u) => a + u.scoreMax * poids(u), 0)
  if (scoreMax === 0) return null
  const score = doubleA.reduce((a, u) => a + u.score * poids(u), 0)
  return Math.round((score / scoreMax) * 20 * 10) / 10
}

export function reussiteEcosParDomaine(tentativesEcos, stationsParId) {
  const groupes = new Map()
  tentativesEcos.forEach((t) => {
    const station = stationsParId[t.station_id]
    if (!station) return
    if (!groupes.has(station.domaine)) groupes.set(station.domaine, { score: 0, scoreMax: 0 })
    const g = groupes.get(station.domaine)
    g.score += t.score || 0
    g.scoreMax += t.score_max || 0
  })
  return groupes
}

// --- Fatigue score (§8 lot 7) : "sans nouvelle donnée", dérivé de date_tentative/duree_s ---

export function reussiteParHeure(tentativesAvecScore) {
  const parHeure = new Map()
  tentativesAvecScore.forEach((t) => {
    const heure = new Date(t.dateTentative).getHours()
    if (!parHeure.has(heure)) parHeure.set(heure, { score: 0, scoreMax: 0 })
    const g = parHeure.get(heure)
    g.score += t.score
    g.scoreMax += t.scoreMax
  })
  return parHeure
}

// Pas de colonne "session_id" (aucune nouvelle donnée) : une nouvelle "session" démarre dès que
// l'écart avec la tentative précédente dépasse ce seuil.
export const SEUIL_PAUSE_SESSION_MIN = 30
export const TRANCHES_DUREE_SESSION = ['0-15', '15-30', '30-60', '60+']

function trancheDureeSession(minutes) {
  if (minutes < 15) return '0-15'
  if (minutes < 30) return '15-30'
  if (minutes < 60) return '30-60'
  return '60+'
}

// Reconstruit des "sessions" à partir du seul ordre chronologique des tentatives, puis regroupe la
// réussite par tranche de minutes écoulées depuis le début de CETTE session (§8 : "durée de
// session").
export function reussiteParDureeSession(tentativesAvecScore) {
  const triees = [...tentativesAvecScore].sort((a, b) => new Date(a.dateTentative) - new Date(b.dateTentative))
  const groupes = new Map()
  let debutSession = null
  let derniereDate = null

  triees.forEach((t) => {
    const date = new Date(t.dateTentative)
    // Nouvelle session si l'écart avec la TENTATIVE PRÉCÉDENTE (pas le début de la session en
    // cours) dépasse le seuil de pause — sinon une longue session continue franchirait le seuil à
    // chaque tentative individuelle et ne formerait jamais de session de plus de 30 min.
    if (derniereDate === null || (date - derniereDate) / 60000 > SEUIL_PAUSE_SESSION_MIN) {
      debutSession = date
    }
    derniereDate = date
    const minutesDepuisDebut = (date - debutSession) / 60000
    const tranche = trancheDureeSession(minutesDepuisDebut)
    if (!groupes.has(tranche)) groupes.set(tranche, { score: 0, scoreMax: 0 })
    const g = groupes.get(tranche)
    g.score += t.score
    g.scoreMax += t.scoreMax
  })

  return groupes
}

const ECHANTILLON_MINIMAL_FATIGUE = 3
const ECART_NET_FATIGUE = 0.2

// Message factuel (§8 : "avec un message factuel si l'écart est net") — un simple constat
// chiffré, jamais une recommandation ("tu devrais...").
export function messageFatigue(parHeureMap) {
  const taux = Array.from(parHeureMap.entries())
    .filter(([, g]) => g.scoreMax >= ECHANTILLON_MINIMAL_FATIGUE)
    .map(([heure, g]) => ({ heure, taux: g.score / g.scoreMax }))
  if (taux.length < 2) return null

  const meilleur = taux.reduce((a, b) => (b.taux > a.taux ? b : a))
  const pire = taux.reduce((a, b) => (b.taux < a.taux ? b : a))
  if (meilleur.taux - pire.taux < ECART_NET_FATIGUE) return null

  return `Réussite la plus haute vers ${meilleur.heure}h (${Math.round(meilleur.taux * 100)}%), la plus basse vers ${pire.heure}h (${Math.round(pire.taux * 100)}%).`
}

// --- Filtre d'obsolescence (§8) ---

export function estObsolete(dateReference, anneeSeuil) {
  if (!dateReference) return false
  return new Date(dateReference).getFullYear() < anneeSeuil
}
