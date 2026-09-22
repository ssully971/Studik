import { getFiches } from '../lib/fiches.js'
import { getCurrentUser } from '../lib/auth.js'
import { getPeriodeActuelle } from '../lib/periode.js'
import { checkinAujourdhui, getCheckins } from '../lib/checkins.js'
import { computeStreak } from '../lib/streak.js'
import { getAllTentativesQcmStats } from '../lib/qcm.js'
import { getMatieres, buildMatiereColorMap, couleurTab, getArbreMatieres, estCoursNoeud } from '../lib/matieres.js'
import { getActiviteParJour } from '../lib/activite.js'
import { getTentativesRatees } from '../lib/cas.js'
import { getQcmTentativesARevoir } from '../lib/qcm.js'
import { renderHeatmap } from './heatmap.js'
import anecdotes from '../data/anecdotes.json'

// Compte les cours sous un noeud de l'arbre matières, et combien sont validés (progression
// 100) — même définition que dans #organisation (lib/matieres.js).
function compterCours(noeud, profondeur) {
  if (estCoursNoeud(noeud, profondeur)) {
    return { total: 1, valides: noeud.progression === 100 ? 1 : 0 }
  }
  return noeud.enfants.reduce(
    (acc, e) => {
      const r = compterCours(e, profondeur + 1)
      return { total: acc.total + r.total, valides: acc.valides + r.valides }
    },
    { total: 0, valides: 0 }
  )
}

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
          <div class="import-actions" style="margin: 0;">
            <button id="checkin-btn" class="btn primary" style="width: auto;">Révisions faites</button>
            <a href="#session" class="btn primary" style="width: auto;">Réviser maintenant</a>
          </div>
        </div>
        <div class="heatmap-popup" id="heatmap-popup"></div>
      </div>

      <div class="section-head">
        <h2 class="voice">Matières</h2>
        <span class="count" id="matiere-count"></span>
      </div>
      <div id="matieres-list" class="fiches-list"></div>

      <div class="section-head" style="margin-top: 40px;">
        <h2 class="voice">En ce moment</h2>
      </div>
      <div class="now-grid now-grid-4" id="now-grid"></div>
    </div>
  `

  await chargerStreak()
  chargerHeatmap()

  async function chargerHeatmap() {
    try {
      const { compte, checkinsParJour } = await getActiviteParJour()
      renderHeatmap(document.getElementById('heatmap-popup'), compte, checkinsParJour)
    } catch {
      // silencieux : la heatmap est un bonus visuel, pas une fonctionnalité critique
    }
  }

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
    const [fiches, tentativesQcm, matieres, arbre, erreursCas, erreursQcm] = await Promise.all([
      getFiches(periode ? { annee: periode.annee, semestre: periode.semestre } : {}),
      getAllTentativesQcmStats(),
      getMatieres({}),
      getArbreMatieres(periode ? { annee: periode.annee, semestre: periode.semestre } : {}),
      getTentativesRatees(),
      getQcmTentativesARevoir(),
    ])
    const ordreParMatiere = {}
    matieres.forEach((m) => {
      ordreParMatiere[m.nom] = m.ordre_affichage ?? 0
    })
    const matiereColorMap = buildMatiereColorMap(matieres)

    const progressionParMatiere = {}
    arbre.forEach((racine) => {
      progressionParMatiere[racine.nom] = compterCours(racine, 0)
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
      list.innerHTML = `<p class="empty-note">Aucune matière pour l'instant. Importe des fiches via #import, ou crée une matière dans #organisation.</p>`
    } else {
      list.innerHTML =
        groups
          .map((g) => {
            const couleur = couleurTab(g.matiere, g.type, matiereColorMap)
            const prog = progressionParMatiere[g.matiere]
            const barre =
              prog && prog.total > 0
                ? `<div class="stat-bar" style="margin-top: 6px;"><div class="stat-bar-fill" style="width: ${Math.round((prog.valides / prog.total) * 100)}%; background: ${couleur};"></div></div>`
                : ''
            return `
        <div class="fiche-row type-${g.type}" data-matiere="${g.matiere}">
          <div class="tab" style="background: ${couleur};"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${g.matiere}</span>
              <span class="type-label">${TYPE_LABELS[g.type]}</span>
            </div>
            <div class="fiche-meta">${g.total} fiche${g.total !== 1 ? 's' : ''} · ${g.validees} validée${g.validees !== 1 ? 's' : ''}${prog && prog.total > 0 ? ` · ${prog.valides}/${prog.total} cours maîtrisés` : ''}</div>
            ${barre}
          </div>
        </div>
      `
          })
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

    const totalErreurs = erreursCas.length + erreursQcm.length

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
      <div class="now-cell" id="now-erreurs" style="cursor: pointer;">
        <div class="label">carnet d'erreurs</div>
        <div class="value voice">${totalErreurs} erreur${totalErreurs !== 1 ? 's' : ''} active${totalErreurs !== 1 ? 's' : ''}</div>
        <div class="desc">${totalErreurs > 0 ? 'Cas et QCM encore à revoir.' : 'Rien en attente, bravo.'}</div>
      </div>
    `

    document.getElementById('now-erreurs').addEventListener('click', () => {
      window.location.hash = '#erreurs'
    })
  } catch (err) {
    document.getElementById('matieres-list').innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
  }
}
