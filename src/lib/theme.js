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
}
