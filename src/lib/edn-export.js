// Exports externat (§8 lot 7) : fonctions pures qui produisent le TEXTE à écrire (CSV Anki) ou le
// texte de correction à afficher (PDF via lib/pdf.js) — jamais de déclenchement de téléchargement
// ici, ça reste à la page appelante (Blob + <a download>, comme le reste du projet).
import { compteCommeVrai } from './edn-scoring.js'

// Mêmes libellés que question-engine.js (non exportés là-bas, dupliqués ici à l'identique plutôt
// que d'exporter une constante interne à un module de rendu DOM pour un module texte-only).
const LABELS_TCS = ['Exclue (--)', 'Moins probable (-)', 'Ne change rien (=)', 'Plus probable (+)', 'Confirmée (++)']
const CLES_TCS = ['-2', '-1', '0', '1', '2']

// Résumé texte de "la bonne réponse" par format — source UNIQUE pour le CSV Anki et le PDF, pour
// ne jamais avoir deux définitions de "qu'est-ce que la correction" qui pourraient diverger.
export function correctionTexte(question) {
  const { format, contenu, explication } = question || {}
  let base = ''

  if (['QRU', 'QRM', 'QRP', 'QRP_LONG'].includes(format)) {
    const bonnes = (contenu?.propositions || []).filter((p) => compteCommeVrai(p.statut)).map((p) => p.texte)
    base = bonnes.length ? `Bonne(s) réponse(s) : ${bonnes.join(' ; ')}` : ''
  } else if (format === 'QROC') {
    const exactes = contenu?.exactes || []
    base = exactes.length ? `Réponse attendue : ${exactes[0]}` : ''
  } else if (format === 'TCS') {
    const votes = contenu?.votes || {}
    const valeurs = CLES_TCS.map((c) => Number(votes[c] ?? 0))
    const maxVotes = Math.max(...valeurs)
    const idx = valeurs.indexOf(maxVotes)
    base = maxVotes > 0 && idx !== -1 ? `Réponse modale : ${LABELS_TCS[idx]}` : ''
  } else if (format === 'ZAP') {
    base = "Question à zones (ZAP) : voir les zones dans l'application."
  }

  return [base, explication].filter(Boolean).join(' — ')
}

// Retire la mise en forme légère (richtext.js) pour un champ texte brut (CSV/PDF) — jamais de
// balise HTML dans un export CSV, pour rester compatible avec un import Anki basique sans "Allow
// HTML in fields".
export function texteBrut(str) {
  return String(str || '')
    .replace(/\[\[img:[^\]]+\]\]/g, '[image]')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    .replace(/!!(.+?)!!/g, '$1')
    .replace(/\r?\n+/g, ' ')
    .trim()
}

function champCsv(valeur) {
  const s = String(valeur ?? '')
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

// Une ligne par question — recto = énoncé, verso = correction + explication (§8 : format Anki).
export function genererLignesCsvAnki(questions) {
  return questions.map((q) => {
    const recto = texteBrut(q.enonce)
    const verso = texteBrut(correctionTexte(q))
    return [champCsv(recto), champCsv(verso)].join(',')
  })
}

export function genererCsvAnki(questions) {
  return genererLignesCsvAnki(questions).join('\n')
}
