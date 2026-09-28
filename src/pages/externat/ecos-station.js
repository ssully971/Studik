import { getStationById } from '../../lib/ecos.js'
import { enregistrerTentativeEcos } from '../../lib/ecos-tentatives.js'
import { scoreGrille, itemsCritiquesManques } from '../../lib/ecos-scoring.js'
import {
  DUREE_STATION_S,
  DUREE_TRANSITION_S,
  creerChrono,
  demarrerChrono,
  terminerChrono,
  secondesRestantes,
  estTermineParTemps,
  repereLectureAtteint,
  alerteFinaleAtteinte,
  formatChrono,
} from '../../lib/ecos-timer.js'
import { jouerBip } from '../../lib/ecos-audio.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { richText } from '../../lib/richtext.js'
import { afficherLoader } from '../../lib/loader.js'
import { avancerCircuitEcos, derniereStationDuCircuit } from './ecos-circuit.js'

// Joueur de station ECOS (§5.9, §8 lot 5). Mode solo (candidat seul, enregistrement audio
// optionnel en mémoire) et mode binôme (un seul appareil : bascule Candidat/Examinateur sur
// mobile, écran partagé sur desktop — pas de synchronisation temps réel entre deux appareils,
// explicitement hors périmètre). `contexteSegment` vaut "circuit" quand la station est jouée
// depuis un enchaînement (voir ecos-circuit.js).
export async function renderEcosStation(container, id, contexteSegment) {
  const enCircuit = contexteSegment === 'circuit'
  const arreterLoader = afficherLoader(container)

  let station
  try {
    station = await getStationById(id)
  } catch (err) {
    arreterLoader()
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Station ECOS</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }
  arreterLoader()

  const state = {
    mode: null, // 'solo' | 'binome'
    onglet: 'candidat', // mobile binôme : 'candidat' | 'examinateur'
    chrono: creerChrono(DUREE_STATION_S),
    cochees: {},
    global: null,
    enregistrerAudio: false,
    mediaRecorder: null,
    audioChunks: [],
    audioUrl: null,
    debutMs: null,
  }

  renderChoixMode()

  function renderChoixMode() {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(station.titre)}</h2>
          <span class="type-label">${escapeHtml(station.domaine)}</span>
        </div>
        ${enCircuit ? `<p class="import-hint">Circuit en cours.</p>` : ''}
        <p class="settings-desc">Interlocuteur : ${escapeHtml(station.interlocuteur)}</p>
        <div class="import-actions">
          <button class="btn primary" id="mode-solo-btn" style="width: auto;">Mode solo</button>
          <button class="btn" id="mode-binome-btn" style="width: auto;">Mode binôme</button>
        </div>
      </div>
    `
    document.getElementById('mode-solo-btn').addEventListener('click', () => {
      state.mode = 'solo'
      renderPret()
    })
    document.getElementById('mode-binome-btn').addEventListener('click', () => {
      state.mode = 'binome'
      renderPret()
    })
  }

  function renderPret() {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(station.titre)}</h2>
          <span class="type-label">${state.mode === 'solo' ? 'Solo' : 'Binôme'}</span>
        </div>
        <p class="settings-desc">8 minutes en tout, lecture de la vignette comprise. Repère à 7:00
        restantes, alerte à 1:00 restante.</p>
        ${
          state.mode === 'solo'
            ? `<label class="checkbox-label" style="width: auto; margin-bottom: 16px;">
                <input type="checkbox" id="enregistrer-audio-checkbox" />
                <span>Enregistrer l'audio (reste sur cet appareil, jamais envoyé)</span>
              </label>`
            : ''
        }
        <div class="import-actions">
          <button class="btn primary" id="demarrer-btn" style="width: auto;">Démarrer <kbd class="kbd-hint">Espace</kbd></button>
        </div>
      </div>
    `

    if (state.mode === 'solo') {
      document.getElementById('enregistrer-audio-checkbox').addEventListener('change', (e) => {
        state.enregistrerAudio = e.target.checked
      })
    }

    document.getElementById('demarrer-btn').addEventListener('click', demarrer)
  }

  async function demarrer() {
    if (state.mode === 'solo' && state.enregistrerAudio) {
      try {
        const flux = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(flux)
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) state.audioChunks.push(e.data)
        }
        recorder.start()
        state.mediaRecorder = recorder
      } catch (err) {
        // L'enregistrement est optionnel : une permission refusée ne doit jamais bloquer la
        // station elle-même.
        state.enregistrerAudio = false
      }
    }

    state.debutMs = Date.now()
    state.chrono = demarrerChrono(state.chrono, state.debutMs)
    jouerBip(880)
    renderEnCours()
  }

  function arreterEnregistrementAudio() {
    if (!state.mediaRecorder) return
    const recorder = state.mediaRecorder
    recorder.addEventListener('stop', () => {
      const blob = new Blob(state.audioChunks, { type: 'audio/webm' })
      state.audioUrl = URL.createObjectURL(blob)
      recorder.stream.getTracks().forEach((t) => t.stop())
    })
    if (recorder.state !== 'inactive') recorder.stop()
  }

  function renderGrilleHTML(interactif) {
    const items = station.grille?.items || []
    if (items.length === 0) return `<p class="empty-note">Aucune grille pour cette station.</p>`
    return `
      <div class="detail-list" id="grille-items">
        ${items
          .map(
            (item) => `
          <label class="checkbox-label" style="width: auto;">
            <input type="checkbox" data-grille-item="${escapeHtml(item.id)}" ${state.cochees[item.id] ? 'checked' : ''} ${interactif ? '' : 'disabled'} />
            <span>${escapeHtml(item.critere)} <span class="type-label">${item.points} pt${item.points !== 1 ? 's' : ''}</span>${item.critique ? ' <span class="type-label" style="color: #C46A5C;">critique</span>' : ''}</span>
          </label>
        `
          )
          .join('')}
      </div>
      ${
        station.grille?.global
          ? `<div style="margin-top: 12px;">
              <label class="settings-desc">Impression globale (1 à 5)</label>
              <select id="grille-global-select" class="periode-select" ${interactif ? '' : 'disabled'}>
                <option value="">—</option>
                ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${state.global === n ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </div>`
          : ''
      }
    `
  }

  function attacherGrilleListeners() {
    document.querySelectorAll('[data-grille-item]').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        state.cochees[cb.dataset.grilleItem] = e.target.checked
      })
    })
    document.getElementById('grille-global-select')?.addEventListener('change', (e) => {
      state.global = e.target.value ? Number(e.target.value) : null
    })
  }

  function renderEnCours() {
    const candidatHTML = `
      <div class="cas-card">
        <p class="cas-situation">${richText(station.vignette || '')}</p>
      </div>
    `
    const examinateurHTML = `
      <div class="settings-card">
        <h3 class="voice">Consignes examinateur</h3>
        <p class="settings-desc">${richText(station.consignes_examinateur || '')}</p>
        ${station.script_interlocuteur ? `<h3 class="voice">Script de l'interlocuteur</h3><p class="settings-desc">${richText(station.script_interlocuteur)}</p>` : ''}
        <h3 class="voice">Grille</h3>
        ${renderGrilleHTML(true)}
      </div>
    `

    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(station.titre)}</h2>
          <span class="voice" id="ecos-chrono" style="font-size: 22px;">${formatChrono(secondesRestantes(state.chrono))}</span>
        </div>
        <p class="import-hint" id="ecos-chrono-hint"></p>
        <div class="import-actions">
          <button class="btn" id="terminer-maintenant-btn" style="width: auto;">Terminer maintenant</button>
        </div>
        ${
          state.mode === 'solo'
            ? candidatHTML
            : `
              <div class="filters" id="binome-onglets">
                <button class="filter-btn ${state.onglet === 'candidat' ? 'active' : ''}" data-onglet="candidat">Candidat</button>
                <button class="filter-btn ${state.onglet === 'examinateur' ? 'active' : ''}" data-onglet="examinateur">Examinateur</button>
              </div>
              <div class="ecos-binome-desktop">
                <div>${candidatHTML}</div>
                <div>${examinateurHTML}</div>
              </div>
              <div class="ecos-binome-mobile">
                ${state.onglet === 'candidat' ? candidatHTML : examinateurHTML}
              </div>
            `
        }
      </div>
    `

    if (state.mode === 'binome') {
      attacherGrilleListeners()
      document.getElementById('binome-onglets').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-onglet]')
        if (!btn) return
        state.onglet = btn.dataset.onglet
        renderEnCours()
      })
    }

    document.getElementById('terminer-maintenant-btn').addEventListener('click', () => {
      clearInterval(timerInterval)
      finirChrono()
    })

    let timerInterval = null
    demarrerTimer()

    function demarrerTimer() {
      clearInterval(timerInterval)
      timerInterval = setInterval(() => {
        const chronoEl = document.getElementById('ecos-chrono')
        if (!chronoEl) {
          clearInterval(timerInterval)
          return
        }
        const restant = secondesRestantes(state.chrono)
        chronoEl.textContent = formatChrono(restant)
        const hintEl = document.getElementById('ecos-chrono-hint')
        if (hintEl) {
          if (alerteFinaleAtteinte(state.chrono)) hintEl.textContent = 'Moins d\'1 minute restante.'
          else if (repereLectureAtteint(state.chrono)) hintEl.textContent = 'Fin de lecture conseillée.'
          else hintEl.textContent = ''
        }
        if (alerteFinaleAtteinte(state.chrono) && restant === 60) jouerBip(660)
        if (estTermineParTemps(state.chrono)) {
          clearInterval(timerInterval)
          finirChrono()
        }
      }, 250)
    }

    function finirChrono() {
      state.chrono = terminerChrono(state.chrono)
      state.dureeS = Math.round((Date.now() - state.debutMs) / 1000)
      jouerBip(440)
      if (state.enregistrerAudio) arreterEnregistrementAudio()
      if (state.mode === 'solo') renderRevelationSolo()
      else renderFinBinome()
    }
  }

  function renderRevelationSolo() {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(station.titre)} — temps écoulé</h2>
        </div>
        <p class="settings-desc">Réécoute-toi si besoin, puis révèle la grille pour t'auto-évaluer.</p>
        ${state.audioUrl ? `<div class="import-actions"><audio controls src="${state.audioUrl}"></audio><a class="btn" href="${state.audioUrl}" download="ecos-${escapeHtml(station.id)}.webm" style="width: auto;">Télécharger l'audio</a></div>` : ''}
        <div class="import-actions">
          <button class="btn primary" id="reveler-btn" style="width: auto;">Révéler la grille</button>
        </div>
      </div>
    `
    document.getElementById('reveler-btn').addEventListener('click', renderAutoPointageSolo)
  }

  function renderAutoPointageSolo() {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(station.titre)} — auto-pointage</h2>
        </div>
        <p class="settings-desc">Coche ce que tu penses avoir fait.</p>
        ${state.audioUrl ? `<div class="import-actions"><audio controls src="${state.audioUrl}"></audio></div>` : ''}
        ${renderGrilleHTML(true)}
        <div class="import-actions">
          <button class="btn primary" id="terminer-station-btn" style="width: auto;">Terminer et enregistrer</button>
        </div>
      </div>
    `
    attacherGrilleListeners()
    document.getElementById('terminer-station-btn').addEventListener('click', enregistrerEtAfficherResultat)
  }

  function renderFinBinome() {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(station.titre)} — temps écoulé</h2>
        </div>
        <p class="settings-desc">Grille de l'examinateur (dernière relecture avant enregistrement) :</p>
        ${renderGrilleHTML(true)}
        <div class="import-actions">
          <button class="btn primary" id="terminer-station-btn" style="width: auto;">Terminer et enregistrer</button>
        </div>
      </div>
    `
    attacherGrilleListeners()
    document.getElementById('terminer-station-btn').addEventListener('click', enregistrerEtAfficherResultat)
  }

  async function enregistrerEtAfficherResultat() {
    const { score, scoreMax } = scoreGrille(station.grille, state.cochees)
    try {
      await enregistrerTentativeEcos({
        stationId: station.id,
        mode: state.mode,
        cochees: state.cochees,
        score,
        scoreMax,
        global: state.global,
        dureeS: state.dureeS ?? null,
      })
    } catch (err) {
      alert('Erreur lors de l\'enregistrement : ' + err.message)
    }
    renderResultat(score, scoreMax)
  }

  function renderResultat(score, scoreMax) {
    const manques = itemsCritiquesManques(station.grille, state.cochees)
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(station.titre)} — résultat</h2>
        </div>
        <p class="cas-situation">Score : ${score} / ${scoreMax}</p>
        ${
          manques.length > 0
            ? `<div class="import-warnings"><p style="margin-bottom: 6px; font-size: 13px; color: var(--mecanisme);">Item${manques.length !== 1 ? 's' : ''} critique${manques.length !== 1 ? 's' : ''} manqué${manques.length !== 1 ? 's' : ''} :</p><ul class="detail-list">${manques.map((m) => `<li>${escapeHtml(m.critere)}</li>`).join('')}</ul></div>`
            : ''
        }
        <div class="import-actions">
          ${enCircuit ? `<button class="btn primary" id="circuit-suivant-btn" style="width: auto;">${derniereStationDuCircuit() ? 'Terminer le circuit' : 'Station suivante'}</button>` : ''}
          <a href="#ecos-stations" class="btn" style="width: auto;">Retour aux stations</a>
        </div>
      </div>
    `
    if (enCircuit) {
      document.getElementById('circuit-suivant-btn').addEventListener('click', () => {
        if (derniereStationDuCircuit()) {
          avancerCircuitEcos()
        } else {
          renderTransitionCircuit()
        }
      })
    }
  }

  function renderTransitionCircuit() {
    let chrono = demarrerChrono(creerChrono(DUREE_TRANSITION_S))
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">Transition</h2>
        </div>
        <p class="cas-situation" id="transition-chrono">${formatChrono(secondesRestantes(chrono))}</p>
        <div class="import-actions">
          <button class="btn primary" id="passer-transition-btn" style="width: auto;">Passer</button>
        </div>
      </div>
    `
    let intervalId = null
    document.getElementById('passer-transition-btn').addEventListener('click', () => {
      clearInterval(intervalId)
      avancerCircuitEcos()
    })
    intervalId = setInterval(() => {
      const el = document.getElementById('transition-chrono')
      if (!el) {
        clearInterval(intervalId)
        return
      }
      el.textContent = formatChrono(secondesRestantes(chrono))
      if (estTermineParTemps(chrono)) {
        clearInterval(intervalId)
        avancerCircuitEcos()
      }
    }, 250)
  }
}
