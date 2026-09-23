import { lirePreference, ecrirePreference } from './preferences.js'

const CLE_FOND = 'studik_fond'
const CLE_FLOU_HERITEE = 'studik_fond_flou' // ancienne clé (avant les réglages détaillés), lue en repli
const CLE_REGLAGES = 'studik_fond_reglages'
const CLE_HISTORIQUE = 'studik_fond_historique'
const FLOU_DEFAUT = 24
const HISTORIQUE_MAX = 20

// Préférences visuelles synchronisées entre appareils via la table Supabase "preferences" (voir
// lib/preferences.js — table clé/valeur générique, aucune nouvelle table/colonne nécessaire pour
// les réglages détaillés ci-dessous), avec un cache local (localStorage) pour un affichage
// instantané sans attendre le réseau : les images elles-mêmes vivent dans le bucket Supabase
// "studik-images" (via lib/images.js), seules leurs URL publiques sont gardées ici.
//
// Le fond est rendu par une couche dédiée #wallpaper-layer (position: fixed, voir main.css),
// insérée en enfant direct de <body> (donc jamais détruite par un render*() qui remplace
// #app/#content) — PAS en arrière-plan de <body> lui-même comme avant : body utilisait
// `background-attachment: fixed`, peu fiable sur iOS Safari (dimensionnement parfois calculé sur
// le document plutôt que le viewport, notamment quand la barre d'adresse se rétracte), ce qui
// pouvait donner une image visuellement "zoomée" (seule une fraction d'une zone plus grande que
// l'écran reste visible). La couche dédiée est dimensionnée uniquement sur le viewport (inset: 0
// + hauteur en dvh avec repli vh, voir main.css), indépendamment du contenu de la page.
//
// Le flou est un vrai `filter: blur()` CSS appliqué à cette couche, PAS une image "cuite" dans un
// canvas réduit puis réappliquée en `background-size: cover` (ancienne technique) : cuire le flou
// dans une image plafonnée à une résolution fixe (900px) puis l'étirer en `cover` sur un écran
// plus large (n'importe quel ordinateur, et les mobiles à forte densité de pixels) créait un
// second niveau de perte — l'upscale CSS de cette image déjà basse résolution — qui donnait un
// flou "pixelisé" au lieu d'un flou net. `filter: blur()` sur un élément DOM est une fonctionnalité
// CSS standard et fiable sur tous les navigateurs modernes y compris iOS Safari (à ne pas
// confondre avec `CanvasRenderingContext2D.filter`, l'API de dessin sur canvas, elle réellement
// peu fiable sur iPad — cause du bug corrigé précédemment sur l'aperçu de l'image avant flou).
// Le flou CSS a besoin de matière au-delà des bords de l'élément pour ne pas éclaircir ses
// bords (rien à flouter au-delà = transparence) : la couche déborde donc du viewport d'environ
// deux fois le rayon de flou (voir calculerStyleFond -> `debord`).

const REGLAGES_PAR_DEFAUT_CHAMP = { mode: 'cover', focal: { x: 50, y: 50 }, assombrissement: 60, flou: FLOU_DEFAUT }

export function getFond() {
  try {
    const raw = localStorage.getItem(CLE_FOND)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Détecte mobile/tablette (pour les réglages séparés téléphone/ordinateur) par capacité réelle
// de l'appareil (pointeur grossier = doigt, ou fenêtre étroite), jamais par user-agent — un
// user-agent peut mentir ou changer, matchMedia reflète l'environnement de rendu réel.
export function contexteAppareil() {
  try {
    const pointeurGrossier = window.matchMedia('(pointer: coarse)').matches
    const etroit = window.matchMedia('(max-width: 768px)').matches
    return pointeurGrossier || etroit ? 'mobile' : 'desktop'
  } catch {
    return 'desktop'
  }
}

function migrerReglagesHerites() {
  let flou = FLOU_DEFAUT
  try {
    const v = parseInt(localStorage.getItem(CLE_FLOU_HERITEE), 10)
    if (Number.isFinite(v)) flou = v
  } catch {
    // silencieux
  }
  return { parAppareil: false, commun: { ...REGLAGES_PAR_DEFAUT_CHAMP, flou }, mobile: null, desktop: null }
}

export function getReglagesBruts() {
  try {
    const raw = localStorage.getItem(CLE_REGLAGES)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { parAppareil: false, commun: REGLAGES_PAR_DEFAUT_CHAMP, mobile: null, desktop: null, ...parsed }
    }
  } catch {
    // silencieux
  }
  return migrerReglagesHerites()
}

function setReglagesBruts(reglages) {
  try {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages))
  } catch {
    // silencieux : le cache local reste secondaire par rapport au serveur
  }
  ecrirePreference('fond_reglages', reglages).catch(() => {})
}

// Fusionne "commun" avec la variante de l'appareil courant si les réglages séparés sont actifs
// ET que cette variante a déjà été personnalisée (sinon retombe sur "commun"). Fonction pure :
// ne lit ni n'écrit rien, testée directement.
export function resoudreReglages(reglages, contexte) {
  const base = { ...REGLAGES_PAR_DEFAUT_CHAMP, ...reglages.commun, focal: { ...REGLAGES_PAR_DEFAUT_CHAMP.focal, ...reglages.commun?.focal } }
  if (!reglages.parAppareil) return base
  const specifique = reglages[contexte]
  if (!specifique) return base
  return { ...base, ...specifique, focal: { ...base.focal, ...specifique.focal } }
}

export function getReglagesEffectifs() {
  return resoudreReglages(getReglagesBruts(), contexteAppareil())
}

export function getParAppareil() {
  return getReglagesBruts().parAppareil
}

export function setParAppareil(actif) {
  const reglages = getReglagesBruts()
  reglages.parAppareil = actif
  setReglagesBruts(reglages)
  appliquerFond()
}

// `cible` = 'commun' (défaut), 'mobile' ou 'desktop' — permet à l'écran Paramètres de modifier
// explicitement le profil téléphone ou ordinateur quand les réglages séparés sont actifs.
function modifierReglages(cible, patch) {
  const reglages = getReglagesBruts()
  if (cible === 'commun') {
    reglages.commun = { ...REGLAGES_PAR_DEFAUT_CHAMP, ...reglages.commun, ...patch, focal: { ...REGLAGES_PAR_DEFAUT_CHAMP.focal, ...reglages.commun?.focal, ...patch.focal } }
  } else {
    const base = reglages[cible] || {}
    reglages[cible] = { ...base, ...patch, focal: { ...base.focal, ...patch.focal } }
  }
  setReglagesBruts(reglages)
  appliquerFond()
}

export function setMode(mode, cible = 'commun') {
  modifierReglages(cible, { mode })
}

export function setFocal(focal, cible = 'commun') {
  modifierReglages(cible, { focal })
}

export function setAssombrissement(valeur, cible = 'commun') {
  modifierReglages(cible, { assombrissement: valeur })
}

export function setFlou(valeur, cible = 'commun') {
  modifierReglages(cible, { flou: valeur })
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
    // silencieux : le cache local reste secondaire par rapport au serveur
  }
  ecrirePreference('fond_historique', liste).catch(() => {})
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

// Rapatrie l'état connu du serveur dans le cache local, puis réapplique — appelée à la
// connexion (voir main.js) pour que le fond d'écran suive Sullivan d'un appareil à l'autre.
// Dégrade en douceur (garde le cache local existant) si hors-ligne ou si la table n'existe pas
// encore, plutôt que de casser l'affichage du fond.
export async function synchroniserFondDepuisServeur() {
  try {
    const [fond, reglages, historique] = await Promise.all([
      lirePreference('fond'),
      lirePreference('fond_reglages'),
      lirePreference('fond_historique'),
    ])
    if (fond !== undefined) {
      if (fond) localStorage.setItem(CLE_FOND, JSON.stringify(fond))
      else localStorage.removeItem(CLE_FOND)
    }
    if (reglages !== undefined && reglages !== null) localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages))
    if (historique !== undefined && historique !== null) localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(historique))
  } catch {
    // silencieux : hors-ligne ou table absente, on reste sur le cache local existant
  }
  appliquerFond()
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
// réduite pour rester rapide. Sert uniquement à calibrer la valeur INITIALE du curseur
// d'assombrissement quand une nouvelle image est choisie (voir setFond) — jamais à changer la
// couleur du texte lui-même, ce qui casserait l'identité visuelle de l'app. En cas d'échec
// (image bloquée par CORS, etc.), renvoie une valeur neutre plutôt que d'échouer.
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

// Thème sombre (texte clair) : une image claire réduit le contraste, il faut assombrir
// davantage. Thème clair (texte foncé) : c'est l'inverse. Toujours au moins un peu de voile
// (25%) même pour l'image la plus favorable ; jusqu'à 95% pour une image au contraire du thème,
// pour que même le texte secondaire (plus pâle que le texte principal) reste conforme WCAG AA
// (>4.5) au pire cas par défaut — vérifié par calcul lors de la conception initiale. Sert
// uniquement à calculer la valeur INITIALE du curseur (voir setFond) ; l'utilisateur peut
// ensuite l'ajuster librement, le curseur ne recalcule plus rien automatiquement après coup.
function assombrissementInitial(luminance) {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  const t = Math.min(Math.max(luminance ?? 128, 0), 255) / 255
  const base = theme === 'dark' ? t : 1 - t
  return Math.round((0.25 + base * 0.7) * 100)
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

const TAILLE_PAR_MODE = { cover: 'cover', contain: 'contain', centre: 'auto' }

// Fonction PURE : calcule le style CSS de la couche de fond à partir des réglages déjà résolus
// (voir resoudreReglages), sans toucher au DOM ni lire quoi que ce soit — testée directement.
export function calculerStyleFond({ fondUrl, reglages, inkHex }) {
  if (!fondUrl) {
    return { backgroundImage: 'none', backgroundColor: 'transparent', filter: 'none', inset: '0px' }
  }

  const taille = TAILLE_PAR_MODE[reglages.mode] || 'cover'
  const position = `${reglages.focal.x}% ${reglages.focal.y}%`
  const [r, g, b] = hexVersRgb(inkHex)
  const opacite = Math.min(1, Math.max(0, reglages.assombrissement / 100))
  const voile = `rgba(${r}, ${g}, ${b}, ${opacite})`
  const flou = Math.max(0, Math.min(40, reglages.flou))
  // Débord = matière à flouter au-delà du bord visible, pour ne jamais éclaircir les bords
  // (voir la note en tête de fichier). ~2x le rayon, arbitraire mais large.
  const debord = flou > 0 ? Math.round(flou * 2) : 0

  return {
    backgroundImage: `linear-gradient(${voile}, ${voile}), url("${fondUrl}")`,
    backgroundSize: `${taille}, ${taille}`,
    backgroundPosition: `${position}, ${position}`,
    backgroundRepeat: 'no-repeat, no-repeat',
    // Fond noir OLED (fixe, pas la couleur --ink du thème) pour les bandes du mode "Ajuster" :
    // ce sont des bords neutres, pas du texte, l'identité "noir OLED" prime sur le thème clair.
    backgroundColor: reglages.mode === 'contain' ? '#000000' : 'transparent',
    filter: flou > 0 ? `blur(${flou}px)` : 'none',
    inset: `${-debord}px`,
  }
}

function assurerCoucheFond() {
  let el = document.getElementById('wallpaper-layer')
  if (!el) {
    el = document.createElement('div')
    el.id = 'wallpaper-layer'
    document.body.prepend(el)
  }
  return el
}

// Synchrone (plus de canvas asynchrone à "cuire") : applique directement les réglages résolus à
// la couche dédiée. Appelée à chaque changement de réglage ou de thème ; le dimensionnement au
// resize/rotation est géré nativement par le CSS (inset: 0 suit le viewport tout seul), sauf la
// bascule mobile/desktop quand les réglages séparés sont actifs, réappliquée explicitement par
// l'écouteur resize/orientationchange tout en bas de ce fichier (une seule fois par changement
// réel de contexte, pas à chaque pixel de redimensionnement).
export function appliquerFond() {
  const el = assurerCoucheFond()
  const fond = getFond()
  const reglages = getReglagesEffectifs()
  const style = calculerStyleFond({ fondUrl: fond?.url || null, reglages, inkHex: couleurInk() })

  el.style.backgroundImage = style.backgroundImage
  el.style.backgroundSize = style.backgroundSize || ''
  el.style.backgroundPosition = style.backgroundPosition || ''
  el.style.backgroundRepeat = style.backgroundRepeat || ''
  el.style.backgroundColor = style.backgroundColor
  el.style.filter = style.filter
  el.style.inset = style.inset
}

// Choisir une nouvelle image recalcule la valeur INITIALE du curseur d'assombrissement (voir
// assombrissementInitial) dans le profil "commun" — un ajustement manuel ultérieur reste ensuite
// stable tant que l'image ne change pas à nouveau.
export function setFond(url, luminance) {
  const valeur = url ? { url, luminance } : null
  try {
    if (valeur) localStorage.setItem(CLE_FOND, JSON.stringify(valeur))
    else localStorage.removeItem(CLE_FOND)
  } catch {
    // silencieux : le cache local reste secondaire par rapport au serveur
  }
  ecrirePreference('fond', valeur).catch(() => {})

  if (url) {
    const reglages = getReglagesBruts()
    reglages.commun = { ...REGLAGES_PAR_DEFAUT_CHAMP, ...reglages.commun, assombrissement: assombrissementInitial(luminance) }
    setReglagesBruts(reglages)
  }

  appliquerFond()
}

// Ne réapplique que si le contexte mobile/desktop a réellement changé (rotation d'une tablette
// pouvant franchir le seuil de largeur, essentiellement) — pas à chaque redimensionnement de
// fenêtre, qui n'a autrement aucun effet ici puisque #wallpaper-layer suit le viewport nativement
// via `inset: 0` (voir main.css). Un seul écouteur, posé une fois au chargement du module (pas
// dans une fonction render*() rappelée à chaque navigation, donc jamais accumulé).
if (typeof window !== 'undefined') {
  let dernierContexte = contexteAppareil()
  let debounceResize = null
  window.addEventListener('resize', () => {
    clearTimeout(debounceResize)
    debounceResize = setTimeout(() => {
      const contexte = contexteAppareil()
      if (contexte !== dernierContexte) {
        dernierContexte = contexte
        if (getReglagesBruts().parAppareil) appliquerFond()
      }
    }, 200)
  })
}
