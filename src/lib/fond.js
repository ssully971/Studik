const CLE_FOND = 'studik_fond'
const CLE_FLOU = 'studik_fond_flou'
const CLE_HISTORIQUE = 'studik_fond_historique'
const FLOU_DEFAUT = 24
const HISTORIQUE_MAX = 20

// Préférences purement visuelles et locales à l'appareil (même mécanisme que le thème dans
// lib/theme.js) : les images elles-mêmes vivent dans le bucket Supabase "studik-images" (via
// lib/images.js), seules leurs URL publiques sont gardées en local — le fond actif (avec sa
// luminance déjà calculée), le niveau de flou, et l'historique des fonds déjà mis en ligne.
//
// Le fond est posé en arrière-plan de <body> lui-même (background-image + background-attachment:
// fixed), pas via un élément séparé superposé : un essai avec un div position:fixed/absolute
// distinct portant l'image (même sans flou CSS) empêchait le texte sans carte opaque derrière
// lui (titres de page, accroche de l'accueil) de s'afficher à l'écran malgré un DOM et des
// styles calculés parfaitement corrects — un souci de composition du navigateur avec un gros
// calque d'image séparé, contourné en évitant complètement ce calque séparé. Le flou est donc
// "cuit" dans l'image via canvas plutôt qu'appliqué en direct par un filtre CSS.

export function getFond() {
  try {
    const raw = localStorage.getItem(CLE_FOND)
    return raw ? JSON.parse(raw) : null
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

// Ajoute une image en tête d'historique (la plus récente d'abord), avec sa luminance déjà
// calculée. Si la limite est dépassée, évince la plus ancienne et renvoie son URL — à
// l'appelant de la supprimer du bucket Supabase (voir #parametres), pour ne jamais laisser une
// image orpheline consommer du stockage sans que Sullivan puisse la retrouver pour la nettoyer.
export function ajouterAuHistorique(url, luminance) {
  let liste = getHistoriqueFonds().filter((f) => f.url !== url)
  liste.unshift({ url, luminance, date: new Date().toISOString() })
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

function chargerImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Impossible de charger l'image."))
    img.src = url
  })
}

// Luminance perçue moyenne d'une image (0 = noir, 255 = blanc), échantillonnée sur une version
// réduite pour rester rapide. Sert uniquement à calibrer l'assombrissement/éclaircissement du
// fond derrière le texte qui n'est pas déjà sur une carte opaque — jamais à changer la couleur
// du texte lui-même, ce qui casserait l'identité visuelle de l'app. En cas d'échec (image
// bloquée par CORS, etc.), renvoie une valeur neutre plutôt que d'échouer.
export async function calculerLuminance(url) {
  try {
    const img = await chargerImage(url)
    const taille = 24
    const canvas = document.createElement('canvas')
    canvas.width = taille
    canvas.height = taille
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, taille, taille)
    const { data } = ctx.getImageData(0, 0, taille, taille)
    let total = 0
    for (let i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return total / (data.length / 4)
  } catch {
    return 128
  }
}

// "Cuit" le flou dans l'image (canvas 2D, filtre blur natif) plutôt que de compter sur un
// filtre CSS en direct sur un calque séparé — voir la note en tête de fichier. Réduit d'abord
// l'image pour rester rapide : un fond flouté n'a de toute façon pas besoin de pleine résolution.
async function genererImageFloutee(url, flouPx) {
  const img = await chargerImage(url)
  const largeurMax = 900
  const echelle = Math.min(1, largeurMax / img.width)
  const largeur = Math.max(1, Math.round(img.width * echelle))
  const hauteur = Math.max(1, Math.round(img.height * echelle))
  const marge = Math.ceil(flouPx * 1.5)

  const canvas = document.createElement('canvas')
  canvas.width = largeur + marge * 2
  canvas.height = hauteur + marge * 2
  const ctx = canvas.getContext('2d')
  ctx.filter = flouPx > 0 ? `blur(${flouPx}px)` : 'none'
  ctx.drawImage(img, marge, marge, largeur, hauteur)
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Thème sombre (texte clair) : une image claire réduit le contraste, il faut assombrir
// davantage. Thème clair (texte foncé) : c'est l'inverse. Toujours au moins un peu de voile
// (0.25) même pour l'image la plus favorable ; jusqu'à 0.95 pour une image au contraire du
// thème, pour que même le texte secondaire (plus pâle que le texte principal) reste conforme
// WCAG AA (>4.5) au pire cas — vérifié par calcul, pas seulement à l'œil.
function calculerOpaciteVoile(luminance) {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  const t = Math.min(Math.max(luminance ?? 128, 0), 255) / 255
  const base = theme === 'dark' ? t : 1 - t
  return 0.25 + base * 0.7
}

function couleurInk() {
  return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#000000'
}

function hexVersRgb(hex) {
  const m = hex.replace('#', '')
  const complet = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(complet, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Jeton incrémenté à chaque appel : si une application plus récente démarre avant qu'une
// précédente (async) ait fini, celle-ci abandonne au lieu d'écraser le résultat plus récent
// avec un résultat obsolète (utile quand on glisse vite le curseur de flou, par exemple).
let jetonApplication = 0

export async function appliquerFond() {
  const jeton = ++jetonApplication
  const fond = getFond()

  if (!fond?.url) {
    document.body.style.backgroundImage = ''
    return
  }

  let dataUrl
  try {
    dataUrl = await genererImageFloutee(fond.url, getFlou())
  } catch {
    return
  }
  if (jeton !== jetonApplication) return // une application plus récente a pris le relais

  const [r, g, b] = hexVersRgb(couleurInk())
  const opaciteVoile = calculerOpaciteVoile(fond.luminance)
  const voile = `rgba(${r}, ${g}, ${b}, ${opaciteVoile})`

  document.body.style.backgroundImage = `linear-gradient(${voile}, ${voile}), url("${dataUrl}")`
  document.body.style.backgroundSize = 'cover, cover'
  document.body.style.backgroundPosition = 'center, center'
  document.body.style.backgroundRepeat = 'no-repeat, no-repeat'
  document.body.style.backgroundAttachment = 'fixed, fixed'
}

export function setFond(url, luminance) {
  try {
    if (url) localStorage.setItem(CLE_FOND, JSON.stringify({ url, luminance }))
    else localStorage.removeItem(CLE_FOND)
  } catch {
    // silencieux : préférence locale, non bloquante
  }
  appliquerFond()
}
