import { lirePreference, ecrirePreference } from './preferences.js'

const CLE_GLASS = 'studik_glass'

// Préférence synchronisée entre appareils (voir lib/preferences.js et la note dans lib/fond.js)
// : bascule entre les cartes pleines habituelles et un style "verre dépoli" (façon Liquid
// Glass) où les cartes/panneaux deviennent translucides et laissent voir le fond d'écran à
// travers elles.
export function getGlass() {
  try {
    return localStorage.getItem(CLE_GLASS) === 'on'
  } catch {
    return false
  }
}

export function setGlass(actif) {
  try {
    localStorage.setItem(CLE_GLASS, actif ? 'on' : 'off')
  } catch {
    // silencieux : le cache local reste secondaire par rapport au serveur
  }
  ecrirePreference('glass', actif).catch(() => {})
  appliquerGlass()
}

export function appliquerGlass() {
  document.documentElement.setAttribute('data-glass', getGlass() ? 'on' : 'off')
}

// Rapatrie l'état connu du serveur dans le cache local, puis réapplique — appelée à la
// connexion (voir main.js). Dégrade en douceur si hors-ligne ou si la table n'existe pas
// encore, plutôt que de casser l'affichage.
export async function synchroniserGlassDepuisServeur() {
  try {
    const valeur = await lirePreference('glass')
    if (valeur !== undefined && valeur !== null) localStorage.setItem(CLE_GLASS, valeur ? 'on' : 'off')
  } catch {
    // silencieux : hors-ligne ou table absente, on reste sur le cache local existant
  }
  appliquerGlass()
}
