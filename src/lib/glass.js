const CLE_GLASS = 'studik_glass'

// Préférence locale à l'appareil (même mécanisme que le thème et le fond d'écran) : bascule
// entre les cartes pleines habituelles et un style "verre dépoli" (façon Liquid Glass) où les
// cartes/panneaux deviennent translucides et laissent voir le fond d'écran à travers elles.
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
    // silencieux : préférence locale, non bloquante
  }
  appliquerGlass()
}

export function appliquerGlass() {
  document.documentElement.setAttribute('data-glass', getGlass() ? 'on' : 'off')
}
