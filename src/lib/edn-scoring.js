// Moteur docimologique EDN (§5 de la spec). Fonctions pures, aucun accès réseau — couvertes par
// edn-scoring.test.js qui reproduit chacun des exemples chiffrés officiels comme cas de test.
// Source : "Règles générales de notation", Conseil scientifique en médecine, 31 janvier 2023.
//
// Ce module ne touche jamais src/lib/scoring.js (barème P2/Outremed, 1/0,5/0) : les deux barèmes
// sont volontairement séparés (§1 "zéro régression sur le mode P2").

export function compteCommeVrai(statut) {
  return statut === 'vrai' || statut === 'indispensable'
}

// --- QRU (§5.2) — binaire : 1 si l'unique bonne réponse est cochée et rien d'autre ---

export function scoreQru(propositions, reponses) {
  const cochees = new Set(reponses)
  const idsCorrects = propositions.filter((p) => compteCommeVrai(p.statut)).map((p) => p.id)
  if (idsCorrects.length !== 1) return 0
  return cochees.size === 1 && cochees.has(idsCorrects[0]) ? 1 : 0
}

// --- QRM (§5.3) — barème par discordance ---

export function scoreQrm(propositions, reponses) {
  const cochees = new Set(reponses)

  const indispensableNonCochee = propositions.some((p) => p.statut === 'indispensable' && !cochees.has(p.id))
  if (indispensableNonCochee) return 0

  const inacceptableCochee = propositions.some((p) => p.statut === 'inacceptable' && cochees.has(p.id))
  if (inacceptableCochee) return 0

  const discordances = propositions.filter((p) => cochees.has(p.id) !== compteCommeVrai(p.statut)).length
  if (discordances === 0) return 1
  if (discordances === 1) return 0.5
  if (discordances === 2) return 0.2
  return 0
}

// --- QRP / QRP_LONG (§5.4, §5.5) — score = x / n, x = vraies/indispensables cochées ---

export function scoreQrp(propositions, n, reponses) {
  const cochees = new Set(reponses)

  const indispensableNonCochee = propositions.some((p) => p.statut === 'indispensable' && !cochees.has(p.id))
  if (indispensableNonCochee) return 0

  const inacceptableCochee = propositions.some((p) => p.statut === 'inacceptable' && cochees.has(p.id))
  if (inacceptableCochee) return 0

  const x = propositions.filter((p) => cochees.has(p.id) && compteCommeVrai(p.statut)).length
  return x / n
}

// QRP_LONG n'a ni indispensable ni inacceptable (interdits à l'import) : le même calcul
// s'applique sans jamais déclencher les gardes ci-dessus.
export const scoreQrpLong = scoreQrp

// --- ZAP (§5.6) — coordonnées en %, conversion du rayon selon le ratio de l'image ---

export function zoneToucheeParClic(zone, clic, dimensionsImage = { largeur: 100, hauteur: 100 }) {
  const { largeur, hauteur } = dimensionsImage
  if (zone.forme === 'cercle') {
    const dx = ((clic.x - zone.cx) / 100) * largeur
    const dy = ((clic.y - zone.cy) / 100) * hauteur
    const rayon = (zone.r / 100) * largeur
    return Math.sqrt(dx * dx + dy * dy) <= rayon
  }
  if (zone.forme === 'rect') {
    return clic.x >= zone.x && clic.x <= zone.x + zone.w && clic.y >= zone.y && clic.y <= zone.y + zone.h
  }
  return false
}

// Un clic compte pour une seule zone ; deux clics dans la même zone comptent une fois (Set).
export function scoreZap(zones, x, clics, dimensionsImage) {
  const zonesTouchees = new Set()
  clics.forEach((clic) => {
    zones.forEach((zone) => {
      if (zoneToucheeParClic(zone, clic, dimensionsImage)) zonesTouchees.add(zone.id)
    })
  })
  return zonesTouchees.size / x
}

// --- QROC (§5.7) — normalisation puis comparaison exacte/acceptable ---

const ARTICLES_INITIAUX = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du'])

export function normaliserReponse(str) {
  const sansAccents = String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const minuscule = sansAccents.toLowerCase()
  const mots = minuscule
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (mots.length > 1 && ARTICLES_INITIAUX.has(mots[0])) mots.shift()
  return mots.join(' ')
}

export function scoreQroc(reponse, exactes, acceptables) {
  const norm = normaliserReponse(reponse || '')
  if (!norm) return 0
  if ((exactes || []).some((e) => normaliserReponse(e) === norm)) return 1
  if ((acceptables || []).some((a) => normaliserReponse(a) === norm)) return 0.5
  return 0
}

// Bouton discret "Ma réponse était juste / acceptable" (§5.7) : rectifie un score QROC déjà
// calculé automatiquement, sans jamais dépasser 1 ni descendre sous le score auto (une correction
// manuelle ne peut qu'améliorer un score jugé trop sévère par la comparaison textuelle).
export function ajusterScoreQroc(scoreAuto, ajustement) {
  if (ajustement === 'juste') return 1
  if (ajustement === 'acceptable') return Math.max(scoreAuto, 0.5)
  return scoreAuto
}

// --- TCS (§5.8) — réponse modale = 1, les autres au prorata des votes ---

export function scoreTcs(votes, reponseChoisie) {
  const valeurs = Object.values(votes).map(Number)
  const maxVotes = Math.max(...valeurs)
  if (maxVotes === 0) return 0
  const votesChoisis = Number(votes[reponseChoisie] ?? 0)
  return votesChoisis / maxVotes
}

// --- Dispatch par format ---

// `reponse` selon le format :
// - QRU/QRM/QRP/QRP_LONG : tableau d'ids de propositions cochées.
// - ZAP : { clics: [{x,y}], dimensionsImage?: {largeur,hauteur} }.
// - QROC : la chaîne de réponse libre.
// - TCS : la clé de vote choisie ("-2".."2").
export function scoreQuestion(question, reponse) {
  const { format, contenu } = question
  switch (format) {
    case 'QRU':
      return scoreQru(contenu.propositions, reponse)
    case 'QRM':
      return scoreQrm(contenu.propositions, reponse)
    case 'QRP':
      return scoreQrp(contenu.propositions, contenu.n, reponse)
    case 'QRP_LONG':
      return scoreQrpLong(contenu.propositions, contenu.n, reponse)
    case 'ZAP':
      return scoreZap(contenu.zones, contenu.x, reponse?.clics || [], reponse?.dimensionsImage)
    case 'QROC':
      return scoreQroc(reponse, contenu.exactes, contenu.acceptables)
    case 'TCS':
      return scoreTcs(contenu.votes, reponse)
    default:
      throw new Error(`Format de question inconnu : ${format}`)
  }
}

// Score d'un dossier : somme simple des scores de ses questions (1 point max par question). Le
// comptage "double" des questions de LCA (§5.10) est un traitement de statistiques agrégées
// (lot 7), pas une règle de notation brute de la tentative — voir DECISIONS.md, lot 3.
export function scoreDossier(questions, reponsesParQuestion) {
  const detail = questions.map((q, i) => scoreQuestion(q, reponsesParQuestion[i]))
  return { score: detail.reduce((a, b) => a + b, 0), scoreMax: questions.length, detail }
}
