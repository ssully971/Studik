import jsPDF from 'jspdf'

const COULEUR_TEXTE = [60, 60, 60]
const COULEUR_SURLIGNE = [195, 154, 92]
const COULEUR_IMPORTANT = [232, 136, 122]

// Remplace les caractères "typographiques" absents de la police standard (WinAnsi) par leur
// équivalent ASCII : jsPDF bascule sinon en mode Unicode pour toute la chaîne, ce qui peut
// corrompre au passage des caractères accentués pourtant valides (ex. "è" -> "h").
function normaliserPourPdf(texte) {
  return texte
    .replace(/\[\[img:[^\]]+\]\]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/ /g, ' ')
}

// Découpe un texte source (avec **gras**/==surligné==/!!important!!) en segments stylés.
function parseSegments(texte) {
  texte = normaliserPourPdf(texte)
  const regex = /\*\*(.+?)\*\*|==(.+?)==|!!(.+?)!!/g
  const segments = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(texte)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: texte.slice(lastIndex, match.index), style: 'normal' })
    }
    if (match[1] !== undefined) segments.push({ text: match[1], style: 'bold' })
    else if (match[2] !== undefined) segments.push({ text: match[2], style: 'highlight' })
    else if (match[3] !== undefined) segments.push({ text: match[3], style: 'important' })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < texte.length) {
    segments.push({ text: texte.slice(lastIndex), style: 'normal' })
  }
  return segments
}

// Éclate les segments en "mots" (espaces gardés comme tokens séparés) pour pouvoir wrapper nous-mêmes.
function decouperEnMots(segments) {
  const mots = []
  segments.forEach((seg) => {
    seg.text.split(/(\s+)/).forEach((partie) => {
      if (partie === '') return
      mots.push({ text: partie, style: seg.style, isSpace: /^\s+$/.test(partie) })
    })
  })
  return mots
}

function appliquerStyle(doc, style) {
  doc.setFont(undefined, style === 'bold' ? 'bold' : 'normal')
  if (style === 'highlight') doc.setTextColor(...COULEUR_SURLIGNE)
  else if (style === 'important') doc.setTextColor(...COULEUR_IMPORTANT)
  else doc.setTextColor(...COULEUR_TEXTE)
}

function largeurMot(doc, mot) {
  appliquerStyle(doc, mot.style)
  return doc.getTextWidth(mot.text)
}

// Regroupe les mots stylés en lignes ne dépassant pas maxWidth (wrap manuel, car chaque
// segment peut changer de police/couleur donc de largeur).
function wrapSegmentsEnLignes(doc, segments, maxWidth) {
  const mots = decouperEnMots(segments)
  const lignes = []
  let ligne = []
  let largeur = 0

  const retirerEspacesFin = (l) => {
    while (l.length && l[l.length - 1].isSpace) l.pop()
    return l
  }

  mots.forEach((mot) => {
    const largeurMotVal = largeurMot(doc, mot)
    if (mot.isSpace) {
      if (ligne.length > 0) {
        ligne.push(mot)
        largeur += largeurMotVal
      }
      return
    }
    if (largeur + largeurMotVal > maxWidth && ligne.length > 0) {
      lignes.push(retirerEspacesFin(ligne))
      ligne = []
      largeur = 0
    }
    ligne.push(mot)
    largeur += largeurMotVal
  })
  if (ligne.length) lignes.push(retirerEspacesFin(ligne))
  return lignes
}

// Fusionne les mots consécutifs de même style en une seule chaîne (les espaces internes
// restent des caractères réels du texte dessiné) : un doc.text() par mot perdait parfois
// l'espace entre deux mots à l'extraction/copie, jsPDF ne dessinant pas de glyphe pour
// un appel .text() qui ne contient que des espaces.
function ecrireLigneStylee(doc, ligne, x, y) {
  let curX = x
  let i = 0
  while (i < ligne.length) {
    const style = ligne[i].style
    let texteRun = ''
    while (i < ligne.length && ligne[i].style === style) {
      texteRun += ligne[i].text
      i++
    }
    appliquerStyle(doc, style)
    doc.text(texteRun, curX, y)
    curX += doc.getTextWidth(texteRun)
  }
}

function addSection(doc, state, titre, contenu) {
  if (!contenu) return
  if (Array.isArray(contenu) && contenu.length === 0) return

  if (state.y > 260) {
    doc.addPage()
    state.y = 20
  }

  doc.setFont(undefined, 'normal')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text(titre, 14, state.y)
  state.y += 7

  doc.setFontSize(10)

  const items = Array.isArray(contenu) ? contenu : [contenu]

  items.forEach((item) => {
    const prefixe = Array.isArray(contenu) ? '•  ' : ''
    const segments = parseSegments(prefixe + item)
    const lignes = wrapSegmentsEnLignes(doc, segments, 180)

    lignes.forEach((ligne) => {
      if (state.y > 280) {
        doc.addPage()
        state.y = 20
      }
      ecrireLigneStylee(doc, ligne, 14, state.y)
      state.y += 5.5
    })
  })

  doc.setFont(undefined, 'normal')
  doc.setTextColor(...COULEUR_TEXTE)
  state.y += 6
}

function ecrireFiche(doc, state, fiche) {
  doc.setFont(undefined, 'normal')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  const titreLignes = doc.splitTextToSize(normaliserPourPdf(fiche.titre), 180)
  doc.text(titreLignes, 14, state.y)
  state.y += titreLignes.length * 8 + 2

  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(
    normaliserPourPdf(`${fiche.matiere} · ${fiche.type}${fiche.tags?.length ? ' · ' + fiche.tags.join(', ') : ''}`),
    14,
    state.y
  )
  state.y += 12

  const contenu = fiche.contenu_structure || {}
  Object.entries(contenu).forEach(([cle, valeur]) => {
    addSection(doc, state, cle.replace(/_/g, ' '), valeur)
  })

  addSection(doc, state, 'Pathologies associées', fiche.pathologies_associees)
  addSection(doc, state, 'Prérequis', fiche.pre_requis)
  addSection(doc, state, 'Conséquences', fiche.consequences)

  if (fiche.notes_perso) {
    addSection(doc, state, 'Notes perso', fiche.notes_perso)
  }
}

export function exporterFichePDF(fiche) {
  const doc = new jsPDF()
  const state = { y: 20 }
  ecrireFiche(doc, state, fiche)
  doc.save(`${fiche.id}.pdf`)
}

export function exporterFichesPDF(fiches, nomFichier) {
  if (!fiches || fiches.length === 0) return

  const doc = new jsPDF()
  const state = { y: 20 }

  fiches.forEach((fiche, index) => {
    if (index > 0) {
      doc.addPage()
      state.y = 20
    }
    ecrireFiche(doc, state, fiche)
  })

  doc.save(`${nomFichier || 'studik-export'}.pdf`)
}
