import { appliquerFond } from './fond.js'

const CLE_THEME = 'studik_theme'

export function getTheme() {
  try {
    return localStorage.getItem(CLE_THEME) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem(CLE_THEME, theme)
  } catch {
    // silencieux : préférence locale, non bloquante
  }
  appliquerTheme()
}

export function appliquerTheme() {
  document.documentElement.setAttribute('data-theme', getTheme())
  // Le voile du fond d'écran (lib/fond.js) est calibré différemment selon le thème (texte clair
  // ou foncé) : le recalculer ici évite qu'il reste calé sur l'ancien thème après un changement.
  appliquerFond()
}
