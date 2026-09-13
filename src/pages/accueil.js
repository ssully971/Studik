import { getFiches } from '../lib/fiches.js'
import { getCurrentUser } from '../lib/auth.js'
import { getPeriodeActuelle } from '../lib/periode.js'
import { checkinAujourdhui, getCheckins } from '../lib/checkins.js'
import { computeStreak } from '../lib/streak.js'
import { getAllTentativesQcmStats } from '../lib/qcm.js'
import { getMatieres } from '../lib/matieres.js'
import anecdotes from '../data/anecdotes.json'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

function pickAnecdote() {
  const debutAnnee = new Date(new Date().getFullYear(), 0, 0)
  const diff = new Date() - debutAnnee
  const jourDeLAnnee = Math.floor(diff / (1000 * 60 * 60 * 24))
  const index = jourDeLAnnee % anecdotes.length
  return anecdotes[index]
}

function getSalutation() {
  const heure = new Date().getHours()
  return heure >= 5 && heure < 18 ? 'Bonjour' : 'Bonsoir'
}

function groupByMatiere(fiches) {
  const groups = {}
  fiches.forEach((f) => {
    if (!groups[f.matiere]) {
      groups[f.matiere] = { matiere: f.matiere, type: f.type, total: 0, validees: 0 }
    }
    groups[f.matiere].total += 1
    if (f.statut === 'valide') groups[f.matiere].validees += 1
  })
  return Object.values(groups)
}

export async function renderAccueil(container) {
  const anecdote = pickAnecdote()
  const user = await getCurrentUser()
  const pseudo = user?.user_metadata?.pseudo
  const salutation = pseudo
    ? `${getSalutation()}, ${pseudo}, voici ton anecdote du jour :`
    : `${getSalutation()}, voici ton anecdote du jour :`

  container.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <p class="kicker">${salutation}</p>
        <h1 class="voice">${anecdote.texte}</h1>
        <a href="${anecdote.lien}" target="_blank" rel="noopener" class="hero-link">En savoir plus →</a>
      </div>

      <div class="settings-card streak-card" style="margin-bottom: 40px;">
        <div class="streak-row">
          <div>
            <div class="streak-value voice" id="streak-actuelle">…</div>
            <div class="settings-desc" id="streak-meilleure" style="margin-bottom: 0;"></div>
          </div>
          <button id="checkin-btn" class="btn primary" style="width: auto;">Je révise aujourd'hui</button>
        </div>
      </div>

      <div class="section-head">
        <h2 class="voice">Matières</h2>
        <span class="count" id="matiere-count"></span>
      </div>
      <div id="matieres-list" class="fiches-list"></div>

      <div class="section-head" style="margin-top: 40px;">
        <h2 class="voice">En ce moment</h2>
      </div>
      <div class="now-grid now-grid-3" id="now-grid"></div>
    </div>
  `

  await chargerStreak()

  async function chargerStreak() {
    try {
      const jours = await getCheckins()
      const { actuelle, meilleure, aCheckeAujourdhui } = computeStreak(jours)

      document.getElementById('streak-actuelle').textContent =
        actuelle > 0 ? `${actuelle} jour${actuelle !== 1 ? 's' : ''} de série` : 'Pas de série en cours'
      document.getElementById('streak-meilleure').textContent = `Meilleure série : ${meilleure} jour${meilleure !== 1 ? 's' : ''}`

      const btn = document.getElementById('checkin-btn')
      if (aCheckeAujourdhui) {
        btn.textContent = "Aujourd'hui : fait ✓"
        btn.disabled = true
      } else {
        btn.addEventListener('click', async () => {
          btn.disabled = true
          try {
            await checkinAujourdhui()
            await chargerStreak()
          } catch (err) {
            btn.disabled = false
            alert('Erreur : ' + err.message)
          }
        })
      }
    } catch (err) {
      document.getElementById('streak-actuelle').textContent = 'Erreur de chargement du streak'
    }
  }

  try {
    const periode = getPeriodeActuelle()
    const [fiches, tentativesQcm, matieres] = await Promise.all([
      getFiches(periode ? { annee: periode.annee, semestre: periode.semestre } : {}),
      getAllTentativesQcmStats(),
      getMatieres({}),
    ])
    const ordreParMatiere = {}
    matieres.forEach((m) => {
      ordreParMatiere[m.nom] = m.ordre_affichage ?? 0
    })
    const groupsTries = groupByMatiere(fiches).sort(
      (a, b) => (ordreParMatiere[a.matiere] ?? 0) - (ordreParMatiere[b.matiere] ?? 0)
    )
    const LIMITE_MATIERES = 6
    const groups = groupsTries.slice(0, LIMITE_MATIERES)
    const nbMatieresRestantes = groupsTries.length - groups.length

    document.getElementById('matiere-count').textContent = `${groupsTries.length} matière${groupsTries.length !== 1 ? 's' : ''}`

    const list = document.getElementById('matieres-list')
    if (groups.length === 0) {
      list.innerHTML = `<p class="empty-note">Aucune matière pour l'instant. Importe des fiches via #import.</p>`
    } else {
      list.innerHTML =
        groups
          .map(
            (g) => `
        <div class="fiche-row type-${g.type}" data-matiere="${g.matiere}">
          <div class="tab"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${g.matiere}</span>
              <span class="type-label">${TYPE_LABELS[g.type]}</span>
            </div>
            <div class="fiche-meta">${g.total} fiche${g.total !== 1 ? 's' : ''} · ${g.validees} validée${g.validees !== 1 ? 's' : ''}</div>
          </div>
        </div>
      `
          )
          .join('') +
        (nbMatieresRestantes > 0
          ? `<a href="#referentiel" class="btn" style="width: auto; margin-top: 4px;">Voir toutes les matières (+${nbMatieresRestantes})</a>`
          : '')

      list.querySelectorAll('.fiche-row').forEach((row) => {
        row.addEventListener('click', () => {
          window.location.hash = '#referentiel'
        })
      })
    }

    const total = fiches.length
    const validees = fiches.filter((f) => f.statut === 'valide').length
    const aRevoir = fiches.filter((f) => f.statut === 'a_revoir').length

    const totalQcm = tentativesQcm.length
    const scoreTotalQcm = tentativesQcm.reduce((s, t) => s + Number(t.score), 0)
    const scoreMaxTotalQcm = tentativesQcm.reduce((s, t) => s + Number(t.score_max), 0)
    const tauxQcm = scoreMaxTotalQcm > 0 ? Math.round((scoreTotalQcm / scoreMaxTotalQcm) * 100) : 0

    document.getElementById('now-grid').innerHTML = `
      <div class="now-cell">
        <div class="label">progression</div>
        <div class="value voice">${total} fiche${total !== 1 ? 's' : ''}, ${validees} validée${validees !== 1 ? 's' : ''}</div>
        <div class="desc">${periode ? 'Sur la période sélectionnée.' : 'Toutes matières confondues.'}</div>
      </div>
      <div class="now-cell">
        <div class="label">à revoir</div>
        <div class="value voice">${aRevoir} fiche${aRevoir !== 1 ? 's' : ''}</div>
        <div class="desc">Marquées comme à revoir dans le référentiel.</div>
      </div>
      <div class="now-cell">
        <div class="label">QCM</div>
        <div class="value voice">${totalQcm > 0 ? `${tauxQcm}% de réussite` : 'Aucun QCM fait'}</div>
        <div class="desc">${totalQcm} QCM traité${totalQcm !== 1 ? 's' : ''} au total.</div>
      </div>
    `
  } catch (err) {
    document.getElementById('matieres-list').innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
  }
}
