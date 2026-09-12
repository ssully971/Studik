import jsPDF from 'jspdf'

function addSection(doc, state, titre, contenu) {
  if (!contenu) return
  if (Array.isArray(contenu) && contenu.length === 0) return

  if (state.y > 260) {
    doc.addPage()
    state.y = 20
  }

  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text(titre, 14, state.y)
  state.y += 7

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  const texte = Array.isArray(contenu) ? contenu.map((c) => `•  ${c}`).join('\n') : contenu
  const lignes = doc.splitTextToSize(texte, 180)

  lignes.forEach((ligne) => {
    if (state.y > 280) {
      doc.addPage()
      state.y = 20
    }
    doc.text(ligne, 14, state.y)
    state.y += 5.5
  })

  state.y += 6
}

function ecrireFiche(doc, state, fiche) {
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  const titreLignes = doc.splitTextToSize(fiche.titre, 180)
  doc.text(titreLignes, 14, state.y)
  state.y += titreLignes.length * 8 + 2

  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(`${fiche.matiere} · ${fiche.type}${fiche.tags?.length ? ' · ' + fiche.tags.join(', ') : ''}`, 14, state.y)
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
