import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { getCurrentUser } from '../../lib/auth.js'
import { pickAnecdote, getSalutation } from '../../lib/accueil-hero.js'
import { checkinAujourdhui, getCheckins } from '../../lib/checkins.js'
import { computeStreak } from '../../lib/streak.js'
import { getActiviteParJour } from '../../lib/activite.js'
import { renderHeatmap } from '../heatmap.js'
import { getPlafondRevisions, getCiblesDuesTriees, getCiblesFlash } from '../../lib/edn-dashboard.js'
import { getTentativesEdnARevoir } from '../../lib/edn-carnet.js'
import { getAllStationIds } from '../../lib/ecos.js'
import { demarrerSessionExternat } from './edn-session.js'
import { preparerHorsLigne } from '../../lib/offline-preparer.js'

// Tableau de bord externat (§7.2) — même esprit visuel que l'accueil P2 (pages/accueil.js) :
// anecdote + salutation en hero, série avec heatmap au survol/tap, une grille "Aujourd'hui"
// informative, puis les actions (révisions dues, Série Flash, hors-ligne) et les raccourcis en
// tuiles colorées. Les données (révisions dues/SRS, Série Flash, hors-ligne) restent celles du
// lot 4/8 — rien de nouveau côté backend, uniquement la présentation. Pas de système XP/niveaux
// (§7.2, écarté).
export async function renderEdnAccueil(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const [{ error }, user] = await Promise.all([supabase.from('edn_srs').select('cible').limit(1), getCurrentUser()])
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Mode Externat</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  const anecdote = pickAnecdote()
  const pseudo = user?.user_metadata?.pseudo
  const salutation = pseudo
    ? `${getSalutation()}, ${pseudo}, voici ton anecdote du jour :`
    : `${getSalutation()}, voici ton anecdote du jour :`

  const plafond = await getPlafondRevisions()
  const [ciblesDues, erreursEdn, stationIds] = await Promise.all([
    getCiblesDuesTriees(plafond).catch(() => []),
    getTentativesEdnARevoir().catch(() => []),
    getAllStationIds().catch(() => []),
  ])
  const pctPlafond = plafond > 0 ? Math.min(100, Math.round((ciblesDues.length / plafond) * 100)) : 0

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
            <div class="streak-value voice" id="edn-streak-actuelle">…</div>
            <div class="settings-desc" id="edn-streak-meilleure" style="margin-bottom: 0;"></div>
          </div>
          <div class="import-actions" style="margin: 0;">
            <button id="edn-checkin-btn" class="btn primary" style="width: auto;">Révisions faites</button>
            ${ciblesDues.length > 0 ? `<button id="commencer-revisions-btn" class="btn primary" style="width: auto;">Commencer mes révisions (${ciblesDues.length})</button>` : ''}
          </div>
        </div>
        <div class="heatmap-popup" id="edn-heatmap-popup"></div>
      </div>

      <div class="section-head">
        <h2 class="voice">Aujourd'hui</h2>
      </div>
      <div class="now-grid now-grid-3" style="margin-bottom: 40px;">
        <div class="now-cell">
          <div class="label">révisions dues</div>
          <div class="value voice">${ciblesDues.length} cible${ciblesDues.length !== 1 ? 's' : ''}</div>
          <div class="desc">Plafond : ${plafond}/jour.</div>
          <div class="stat-bar"><div class="stat-bar-fill" style="width: ${pctPlafond}%; background: var(--mecanisme);"></div></div>
        </div>
        <div class="now-cell" id="edn-now-erreurs" style="cursor: pointer;">
          <div class="label">carnet d'erreurs</div>
          <div class="value voice">${erreursEdn.length} erreur${erreursEdn.length !== 1 ? 's' : ''}</div>
          <div class="desc">${erreursEdn.length > 0 ? 'Externat, encore à revoir.' : 'Rien en attente, bravo.'}</div>
        </div>
        <div class="now-cell" id="edn-now-ecos" style="cursor: pointer;">
          <div class="label">stations ECOS</div>
          <div class="value voice">${stationIds.length} station${stationIds.length !== 1 ? 's' : ''}</div>
          <div class="desc">Disponibles à réviser.</div>
        </div>
      </div>

      <div class="section-head">
        <h2 class="voice">Réviser</h2>
      </div>
      <div class="settings-stack" style="margin-bottom: 40px;">
        <div class="settings-card settings-card-accent" style="--accent-carte: var(--clinique);">
          <h3 class="voice">Série Flash</h3>
          <p class="settings-desc">5 cibles courtes, pour réviser entre deux patients.</p>
          <div class="import-actions">
            <button id="serie-flash-btn" class="btn primary" style="width: auto;">Lancer une série Flash</button>
          </div>
        </div>

        <div class="settings-card settings-card-accent" style="--accent-carte: var(--text-faint);">
          <h3 class="voice">Hors-ligne</h3>
          <p class="settings-desc" id="hors-ligne-desc">Télécharge les révisions dues et leurs images pour les consulter sans connexion.</p>
          <div class="import-actions">
            <button id="preparer-hors-ligne-btn" class="btn" style="width: auto;">Préparer le hors-ligne</button>
          </div>
        </div>
      </div>

      <div class="section-head">
        <h2 class="voice">Raccourcis</h2>
      </div>
      <div class="raccourci-tile-grid">
        <a href="#edn-banque" class="raccourci-tile" style="--accent-carte: var(--structure);">
          <span class="titre voice">Banque</span>
          <span class="desc">Questions et dossiers EDN.</span>
        </a>
        <a href="#ecos-stations" class="raccourci-tile" style="--accent-carte: var(--mecanisme);">
          <span class="titre voice">ECOS</span>
          <span class="desc">Stations chronométrées.</span>
        </a>
        <a href="#erreurs" class="raccourci-tile" style="--accent-carte: #C46A5C;">
          <span class="titre voice">Carnet d'erreurs</span>
          <span class="desc">Ce qu'il reste à revoir.</span>
        </a>
        <a href="#edn-items" class="raccourci-tile" style="--accent-carte: var(--clinique);">
          <span class="titre voice">Items R2C</span>
          <span class="desc">Référentiel et prioritaires.</span>
        </a>
        <a href="#referentiel" class="raccourci-tile" style="--accent-carte: var(--text-faint);">
          <span class="titre voice">Référentiel</span>
          <span class="desc">Fiches P2.</span>
        </a>
      </div>
    </div>
  `

  document.getElementById('commencer-revisions-btn')?.addEventListener('click', () => {
    demarrerSessionExternat(ciblesDues, 'Révisions dues', 'entrainement')
  })

  document.getElementById('edn-now-erreurs').addEventListener('click', () => {
    window.location.hash = '#erreurs'
  })

  document.getElementById('edn-now-ecos').addEventListener('click', () => {
    window.location.hash = '#ecos-stations'
  })

  document.getElementById('preparer-hors-ligne-btn').addEventListener('click', async () => {
    const btn = document.getElementById('preparer-hors-ligne-btn')
    const desc = document.getElementById('hors-ligne-desc')
    btn.disabled = true
    try {
      const { nombreCibles } = await preparerHorsLigne({
        onProgression: (fait, total) => {
          desc.textContent = `Téléchargement… ${fait} / ${total}`
        },
      })
      desc.textContent = nombreCibles > 0 ? `${nombreCibles} cible(s) prête(s) hors-ligne.` : 'Aucune cible due à préparer pour le moment.'
    } catch (err) {
      desc.textContent = 'Erreur : ' + err.message
    } finally {
      btn.disabled = false
    }
  })

  document.getElementById('serie-flash-btn').addEventListener('click', async () => {
    const btn = document.getElementById('serie-flash-btn')
    btn.disabled = true
    try {
      const cibles = await getCiblesFlash()
      if (cibles.length === 0) {
        alert("Aucune cible disponible pour l'instant (importe des questions d'abord).")
        btn.disabled = false
        return
      }
      demarrerSessionExternat(cibles, 'Série Flash', 'flash')
    } catch (err) {
      alert('Erreur : ' + err.message)
      btn.disabled = false
    }
  })

  // Même mécanique que la carte série de l'accueil P2 (pages/accueil.js) : le survol (:hover) ne
  // suffit pas au tactile, un tap sur la carte bascule aussi la heatmap, sauf si on a touché un
  // bouton à l'intérieur. Écouteur posé sur `.wrap` (recréé à chaque rendu de cette page, donc
  // jamais accumulé) plutôt que sur `document` (persistant sur toute la session).
  const streakCard = document.querySelector('.streak-card')
  streakCard.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return
    streakCard.classList.toggle('ouvert')
  })
  container.querySelector('.wrap').addEventListener('click', (e) => {
    if (!streakCard.contains(e.target)) streakCard.classList.remove('ouvert')
  })

  chargerHeatmap()
  chargerStreak()

  async function chargerHeatmap() {
    try {
      const { compte, checkinsParJour } = await getActiviteParJour()
      renderHeatmap(document.getElementById('edn-heatmap-popup'), compte, checkinsParJour)
    } catch {
      // silencieux : la heatmap est un bonus visuel, pas une fonctionnalité critique
    }
  }

  async function chargerStreak() {
    try {
      const jours = await getCheckins()
      const { actuelle, meilleure, aCheckeAujourdhui } = computeStreak(jours)

      document.getElementById('edn-streak-actuelle').textContent =
        actuelle > 0 ? `${actuelle} jour${actuelle !== 1 ? 's' : ''} de série` : 'Pas de série en cours'
      document.getElementById('edn-streak-meilleure').textContent = `Meilleure série : ${meilleure} jour${meilleure !== 1 ? 's' : ''}`

      const btn = document.getElementById('edn-checkin-btn')
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
      document.getElementById('edn-streak-actuelle').textContent = 'Erreur de chargement du streak : ' + escapeHtml(err.message)
    }
  }
}
