import { FENETRE_JOURS } from '../lib/activite.js'

function niveauIntensite(count) {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

const MOIS_COURTS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']
const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const LIGNES_AVEC_LABEL = [0, 2, 4] // lundi, mercredi, vendredi

function formatDateCourte(date) {
  return `${date.getDate()} ${MOIS_COURTS[date.getMonth()]}`
}

// 0 = lundi ... 6 = dimanche (Date.getDay() renvoie 0 = dimanche par défaut)
function jourSemaineLundi(date) {
  return (date.getDay() + 6) % 7
}

export function renderHeatmap(container, compte) {
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)

  const joursReels = []
  for (let i = FENETRE_JOURS - 1; i >= 0; i--) {
    const d = new Date(aujourdhui)
    d.setDate(d.getDate() - i)
    joursReels.push(d)
  }

  // Complète le début et la fin pour que la grille s'aligne sur des semaines lundi→dimanche.
  const decalageDebut = jourSemaineLundi(joursReels[0])
  const decalageFin = 6 - jourSemaineLundi(joursReels[joursReels.length - 1])
  const cellules = [...Array(decalageDebut).fill(null), ...joursReels, ...Array(decalageFin).fill(null)]

  const semaines = []
  for (let i = 0; i < cellules.length; i += 7) {
    semaines.push(cellules.slice(i, i + 7))
  }

  let dernierMoisAffiche = null
  const labelsMois = semaines.map((semaine) => {
    const jour = semaine.find((d) => d !== null)
    if (!jour) return ''
    const mois = jour.getMonth()
    if (mois !== dernierMoisAffiche) {
      dernierMoisAffiche = mois
      return MOIS_COURTS[mois]
    }
    return ''
  })

  container.innerHTML = `
    <div class="heatmap-wrapper">
      <div class="heatmap-months">
        <div class="heatmap-months-spacer"></div>
        <div class="heatmap-months-row">
          ${labelsMois.map((label) => `<span class="heatmap-month-label">${label}</span>`).join('')}
        </div>
      </div>
      <div class="heatmap-body">
        <div class="heatmap-days-labels">
          ${JOURS_SEMAINE.map((lettre, i) => `<span class="heatmap-day-label">${LIGNES_AVEC_LABEL.includes(i) ? lettre : ''}</span>`).join('')}
        </div>
        <div class="heatmap-grid">
          ${semaines
            .map(
              (semaine) => `
            <div class="heatmap-col">
              ${semaine
                .map((jour) => {
                  if (!jour) return `<div class="heatmap-cell heatmap-cell-vide"></div>`
                  const iso = jour.toISOString().slice(0, 10)
                  const count = compte[iso] || 0
                  return `<div class="heatmap-cell niveau-${niveauIntensite(count)}" title="${formatDateCourte(jour)} · ${count} action${count !== 1 ? 's' : ''}"></div>`
                })
                .join('')}
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
    <div class="heatmap-legende">
      <span>Moins</span>
      <span class="heatmap-cell niveau-0"></span>
      <span class="heatmap-cell niveau-1"></span>
      <span class="heatmap-cell niveau-2"></span>
      <span class="heatmap-cell niveau-3"></span>
      <span class="heatmap-cell niveau-4"></span>
      <span>Plus</span>
    </div>
  `
}
