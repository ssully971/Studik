const CLE_FOND = 'studik_fond'
const CLE_FLOU = 'studik_fond_flou'
const CLE_HISTORIQUE = 'studik_fond_historique'
const FLOU_DEFAUT = 24
const HISTORIQUE_MAX = 20

// Préférences purement visuelles et locales à l'appareil (même mécanisme que le thème dans
// lib/theme.js) : les images elles-mêmes vivent dans le bucket Supabase "studik-images" (via
// lib/images.js), seules leurs URL publiques sont gardées en local — le fond actif, le niveau
// de flou, et l'historique des fonds déjà mis en ligne (pour changer sans réimporter, ou pour
// les supprimer explicitement du stockage).

export function getFond() {
  try {
    return localStorage.getItem(CLE_FOND) || null
  } catch {
    return null
  }
}

export function getFlou() {
  try {
    const v = parseInt(localStorage.getItem(CLE_FLOU), 10)
    return Number.isFinite(v) ? v : FLOU_DEFAUT
  } catch {
    return FLOU_DEFAUT
  }
}

export function setFlou(valeur) {
  try {
    localStorage.setItem(CLE_FLOU, String(valeur))
  } catch {
    // silencieux : préférence locale, non bloquante
  }
  appliquerFond()
}

export function getHistoriqueFonds() {
  try {
    const raw = localStorage.getItem(CLE_HISTORIQUE)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setHistoriqueFonds(liste) {
  try {
    localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste))
  } catch {
    // silencieux : préférence locale, non bloquante
  }
}

// Ajoute une image en tête d'historique (la plus récente d'abord). Si la limite est dépassée,
// évince la plus ancienne et renvoie son URL — à l'appelant de la supprimer du bucket Supabase
// (voir #parametres), pour ne jamais laisser une image orpheline consommer du stockage sans que
// Sullivan puisse la retrouver pour la nettoyer.
export function ajouterAuHistorique(url) {
  let liste = getHistoriqueFonds().filter((f) => f.url !== url)
  liste.unshift({ url, date: new Date().toISOString() })
  let evincee = null
  if (liste.length > HISTORIQUE_MAX) {
    evincee = liste[liste.length - 1].url
    liste = liste.slice(0, HISTORIQUE_MAX)
  }
  setHistoriqueFonds(liste)
  return evincee
}

export function retirerDeLHistorique(url) {
  setHistoriqueFonds(getHistoriqueFonds().filter((f) => f.url !== url))
}

function elementFond() {
  let el = document.getElementById('wallpaper')
  if (!el) {
    el = document.createElement('div')
    el.id = 'wallpaper'
    document.body.prepend(el)
  }
  return el
}

export function appliquerFond() {
  const url = getFond()
  const el = elementFond()
  el.style.filter = `blur(${getFlou()}px)`
  if (url) {
    el.style.backgroundImage = `url("${url}")`
    el.classList.add('actif')
  } else {
    el.style.backgroundImage = ''
    el.classList.remove('actif')
  }
}

export function setFond(url) {
  try {
    if (url) localStorage.setItem(CLE_FOND, url)
    else localStorage.removeItem(CLE_FOND)
  } catch {
    // silencieux : préférence locale, non bloquante
  }
  appliquerFond()
}
