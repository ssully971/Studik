import { lirePreference, ecrirePreference } from './preferences.js'

// Le "cycle d'études" (P2 ↔ Externat) est une préférence synchronisée entre appareils (comme
// fond.js/glass.js) : c'est un choix de période de vie, pas d'appareil. Un cache localStorage
// évite un flash au démarrage (badge/navigation P2 le temps que le serveur réponde).
const CLE_CYCLE = 'studik_cycle'
export const CYCLE_PAR_DEFAUT = 'preclinique'
export const CYCLES_VALIDES = ['preclinique', 'externat']

const abonnes = new Set()

export function getCycle() {
  try {
    const valeur = localStorage.getItem(CLE_CYCLE)
    return CYCLES_VALIDES.includes(valeur) ? valeur : CYCLE_PAR_DEFAUT
  } catch {
    return CYCLE_PAR_DEFAUT
  }
}

export function estExternat() {
  return getCycle() === 'externat'
}

function notifier() {
  abonnes.forEach((fn) => {
    try {
      fn(getCycle())
    } catch {
      // un abonné qui échoue ne doit pas casser les autres
    }
  })
}

// S'abonner aux changements de cycle (ex. main.js re-rend la navigation, le badge topbar).
// Renvoie une fonction de désabonnement.
export function onCycleChange(fn) {
  abonnes.add(fn)
  return () => abonnes.delete(fn)
}

export function setCycle(cycle) {
  if (!CYCLES_VALIDES.includes(cycle)) throw new Error(`Cycle invalide : ${cycle}`)
  try {
    localStorage.setItem(CLE_CYCLE, cycle)
  } catch {
    // silencieux : le cache local reste secondaire par rapport au serveur
  }
  notifier()
  ecrirePreference('cycle', cycle).catch(() => {})
}

// Rapatrie l'état connu du serveur dans le cache local — appelée à la connexion (voir main.js).
// Dégrade en douceur si hors-ligne ou si la préférence n'a jamais été écrite : on reste alors sur
// le cache local (ou le défaut préclinique).
export async function synchroniserCycleDepuisServeur() {
  try {
    const valeur = await lirePreference('cycle')
    if (CYCLES_VALIDES.includes(valeur)) {
      const avant = getCycle()
      localStorage.setItem(CLE_CYCLE, valeur)
      if (avant !== valeur) notifier()
    }
  } catch {
    // silencieux : hors-ligne, on reste sur le cache local existant
  }
}
