// Circuit ECOS (§5.9, option) : enchaîne plusieurs stations avec une transition de 2:00 entre
// deux, en réutilisant #ecos-station tel quel (3e segment de hash "circuit") — même principe que
// edn-session.js pour les sessions de révision, jamais un joueur dédié dupliqué.
let file = []
let indexCourant = 0

export function demarrerCircuitEcos(stationIds) {
  file = stationIds
  indexCourant = 0
  aller()
}

function aller() {
  window.location.hash = `#ecos-station/${encodeURIComponent(file[indexCourant])}/circuit`
}

export function circuitActif() {
  return file.length > 0
}

export function positionCircuit() {
  return { index: indexCourant, total: file.length }
}

export function derniereStationDuCircuit() {
  return indexCourant >= file.length - 1
}

export function avancerCircuitEcos() {
  indexCourant++
  if (indexCourant >= file.length) {
    file = []
    indexCourant = 0
    window.location.hash = '#ecos-stations'
    return
  }
  aller()
}

export function arreterCircuitEcos() {
  file = []
  indexCourant = 0
}
