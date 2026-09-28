import { supabase } from '../../lib/supabase.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { checkinAujourdhui, getCheckins } from '../../lib/checkins.js'
import { computeStreak } from '../../lib/streak.js'
import { getPlafondRevisions, getCiblesDuesTriees, getCiblesFlash } from '../../lib/edn-dashboard.js'
import { demarrerSessionExternat } from './edn-session.js'

// Tableau de bord externat (§7.2) — révisions dues (SRS), Série Flash, raccourcis, streak
// (identique au fonctionnement P2, carte simplifiée ici plutôt que dupliquer le composant riche
// de pages/accueil.js — voir DECISIONS.md, lot 4). Pas de système XP/niveaux (§7.2, écarté).
export async function renderEdnAccueil(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const { error } = await supabase.from('edn_srs').select('cible').limit(1)
  if (error && estTableAbsente(error)) {
    container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Mode Externat</h2></div>${htmlMigrationManquante('001')}</div>`
    return
  }

  const plafond = await getPlafondRevisions()
  let ciblesDues = []
  try {
    ciblesDues = await getCiblesDuesTriees(plafond)
  } catch {
    ciblesDues = []
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Mode Externat</h2>
      </div>

      <div class="settings-card" style="margin-bottom: 20px;">
        <h3 class="voice">Révisions dues aujourd'hui</h3>
        <p class="settings-desc">${ciblesDues.length} cible${ciblesDues.length !== 1 ? 's' : ''} due${ciblesDues.length !== 1 ? 's' : ''} (plafond : ${plafond}/jour).</p>
        ${ciblesDues.length > 0 ? `<div class="import-actions"><button id="commencer-revisions-btn" class="btn primary" style="width: auto;">Commencer</button></div>` : ''}
      </div>

      <div class="settings-card" style="margin-bottom: 20px;">
        <h3 class="voice">Série Flash</h3>
        <p class="settings-desc">5 cibles courtes, pour réviser entre deux patients.</p>
        <div class="import-actions">
          <button id="serie-flash-btn" class="btn primary" style="width: auto;">Lancer une série Flash</button>
        </div>
      </div>

      <div class="settings-card" style="margin-bottom: 20px;">
        <h3 class="voice">Raccourcis</h3>
        <div class="import-actions" style="flex-wrap: wrap;">
          <a href="#edn-banque" class="btn" style="width: auto;">Banque</a>
          <a href="#ecos-stations" class="btn" style="width: auto;">ECOS</a>
          <a href="#erreurs" class="btn" style="width: auto;">Carnet d'erreurs</a>
          <a href="#edn-items" class="btn" style="width: auto;">Items R2C</a>
          <a href="#referentiel" class="btn" style="width: auto;">Référentiel</a>
        </div>
      </div>

      <div class="settings-card streak-card-simple" style="margin-bottom: 20px;">
        <h3 class="voice">Série</h3>
        <div class="settings-desc" id="edn-streak-actuelle">…</div>
        <div class="settings-desc" id="edn-streak-meilleure"></div>
        <div class="import-actions">
          <button id="edn-checkin-btn" class="btn" style="width: auto;">Check-in aujourd'hui</button>
        </div>
      </div>
    </div>
  `

  document.getElementById('commencer-revisions-btn')?.addEventListener('click', () => {
    demarrerSessionExternat(ciblesDues, 'Révisions dues', 'entrainement')
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

  try {
    const jours = await getCheckins()
    const { actuelle, meilleure, aCheckeAujourdhui } = computeStreak(jours)
    document.getElementById('edn-streak-actuelle').textContent = `Série actuelle : ${actuelle} jour${actuelle !== 1 ? 's' : ''}`
    document.getElementById('edn-streak-meilleure').textContent = `Meilleure série : ${meilleure} jour${meilleure !== 1 ? 's' : ''}`
    const checkinBtn = document.getElementById('edn-checkin-btn')
    if (aCheckeAujourdhui) {
      checkinBtn.textContent = 'Déjà fait aujourd’hui'
      checkinBtn.disabled = true
    } else {
      checkinBtn.addEventListener('click', async () => {
        checkinBtn.disabled = true
        try {
          await checkinAujourdhui()
          checkinBtn.textContent = 'Déjà fait aujourd’hui'
        } catch (err) {
          checkinBtn.disabled = false
          alert('Erreur : ' + err.message)
        }
      })
    }
  } catch (err) {
    document.getElementById('edn-streak-actuelle').textContent = 'Erreur de chargement du streak : ' + escapeHtml(err.message)
  }
}
