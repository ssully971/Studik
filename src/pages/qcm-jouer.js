import { getQcmById, enregistrerTentativeQcm, scoreQuestion, scoreQcm } from '../lib/qcm.js'
import { getProgressionByQcmId, sauvegarderProgression, supprimerProgression } from '../lib/qcm-progression.js'

let timerInterval = null

function clearTimerIfAny() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function formatTemps(secondes) {
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export async function renderQcmJouer(container, qcmId) {
  clearTimerIfAny()
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let qcm
  try {
    qcm = await getQcmById(qcmId)
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  let progression = null
  try {
    progression = await getProgressionByQcmId(qcmId)
  } catch {
    progression = null
  }

  if (progression) {
    reprendreQcm(container, qcm, progression)
  } else {
    renderChoixMode(container, qcm)
  }
}

function renderChoixMode(container, qcm) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">${qcm.titre}</h2>
      </div>
      <p class="import-hint">${qcm.questions.length} question${qcm.questions.length !== 1 ? 's' : ''} · ${(qcm.matieres || []).join(', ') || 'aucune matière'}</p>

      <div class="cas-card">
        <p class="cas-situation">Choisis le mode dans lequel tu veux faire ce QCM.</p>
        <div class="import-actions">
          <button id="mode-entrainement-btn" class="btn primary" style="width: auto;">Entraînement</button>
          <button id="mode-concours-btn" class="btn" style="width: auto;">Concours (${qcm.duree_minutes} min)</button>
        </div>
        <p class="settings-desc" style="margin-top: 10px;">
          Entraînement : correction affichée après chaque question.<br>
          Concours : minuteur, corrections révélées seulement à la fin. Tu peux refaire ce QCM autant de fois que tu veux.
        </p>
      </div>
    </div>
  `

  document.getElementById('mode-entrainement-btn').addEventListener('click', () => {
    demarrerQcm(container, qcm, 'entrainement')
  })

  document.getElementById('mode-concours-btn').addEventListener('click', () => {
    demarrerQcm(container, qcm, 'concours')
  })
}

function figerChrono(state) {
  if (state.mode === 'entrainement') {
    state.chronoEcouleSecondes += Math.floor((Date.now() - state.debutTick) / 1000)
    state.debutTick = Date.now()
  }
}

function sauvegarderProgressionSilencieux(qcm, state) {
  sauvegarderProgression({
    qcmId: qcm.id,
    mode: state.mode,
    indexCourant: state.index,
    reponses: state.reponses,
    dateFinPrevue: state.dateFinPrevue ? new Date(state.dateFinPrevue).toISOString() : null,
    chronoEcouleSecondes: state.chronoEcouleSecondes,
  }).catch((err) => console.error('Erreur sauvegarde progression QCM', err))
}

function demarrerTimer(container, qcm, state) {
  clearTimerIfAny()
  if (state.mode === 'concours') {
    timerInterval = setInterval(() => {
      const timerEl = document.getElementById('qcm-timer')
      if (!timerEl) {
        clearTimerIfAny()
        return
      }
      const tempsRestant = Math.max(0, Math.round((state.dateFinPrevue - Date.now()) / 1000))
      timerEl.textContent = formatTemps(tempsRestant)
      if (tempsRestant <= 0) {
        clearTimerIfAny()
        terminerQcm(container, qcm, state.mode, state)
      }
    }, 1000)
  } else {
    timerInterval = setInterval(() => {
      const timerEl = document.getElementById('qcm-timer')
      if (!timerEl) {
        clearTimerIfAny()
        return
      }
      const ecoule = state.chronoEcouleSecondes + Math.floor((Date.now() - state.debutTick) / 1000)
      timerEl.textContent = formatTemps(ecoule)
    }, 1000)
  }
}

function demarrerQcm(container, qcm, mode) {
  const maintenant = Date.now()
  const state = {
    index: 0,
    reponses: qcm.questions.map((q) => q.items.map(() => false)),
    corrigees: qcm.questions.map(() => false),
    mode,
    dateFinPrevue: mode === 'concours' ? maintenant + qcm.duree_minutes * 60 * 1000 : null,
    chronoEcouleSecondes: 0,
    debutTick: maintenant,
  }

  sauvegarderProgressionSilencieux(qcm, state)
  demarrerTimer(container, qcm, state)
  renderQuestion(container, qcm, mode, state)
}

function reprendreQcm(container, qcm, progression) {
  const reponsesValides =
    Array.isArray(progression.reponses) && progression.reponses.length === qcm.questions.length
      ? progression.reponses
      : qcm.questions.map((q) => q.items.map(() => false))

  const state = {
    index: Math.min(progression.index_courant, qcm.questions.length - 1),
    reponses: reponsesValides,
    corrigees: qcm.questions.map(() => false),
    mode: progression.mode,
    dateFinPrevue: progression.date_fin_prevue ? new Date(progression.date_fin_prevue).getTime() : null,
    chronoEcouleSecondes: progression.chrono_ecoule_secondes || 0,
    debutTick: Date.now(),
  }

  demarrerTimer(container, qcm, state)
  renderQuestion(container, qcm, state.mode, state)
}

function renderCorrectionItems(question, reponsesItem) {
  return `
    <ul class="detail-list" style="margin-top: 10px;">
      ${question.items
        .map((item, i) => {
          const coche = reponsesItem[i]
          const correcte = item.correct
          const explication = item.explication || question.explication
          let classe = 'item-explication-neutre'
          let symbole = '—'
          if (correcte && coche) {
            classe = 'item-explication-ok'
            symbole = '✔'
          } else if (correcte && !coche) {
            classe = 'item-explication-missed'
            symbole = '✘ manqué'
          } else if (!correcte && coche) {
            classe = 'item-explication-wrong'
            symbole = '✘ erreur'
          } else {
            symbole = correcte ? '✔' : '—'
          }
          return `<li class="${classe}"><span class="item-explication-symbole">${symbole}</span> <strong>${item.texte}</strong>${explication ? ` — ${explication}` : ''}</li>`
        })
        .join('')}
    </ul>
  `
}

function renderQuestion(container, qcm, mode, state) {
  const q = qcm.questions[state.index]
  const reponsesQuestion = state.reponses[state.index]

  const timerInitial =
    mode === 'concours'
      ? formatTemps(Math.max(0, Math.round((state.dateFinPrevue - Date.now()) / 1000)))
      : formatTemps(state.chronoEcouleSecondes)

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">${qcm.titre}</h2>
        <span class="count">Question ${state.index + 1} / ${qcm.questions.length} · <span id="qcm-timer">${timerInitial}</span></span>
      </div>

      <div class="cas-card">
        <p class="cas-situation">${q.enonce}</p>
        ${q.image ? `<div class="qcm-question-image"><img src="${q.image}" alt="" /></div>` : ''}

        <div class="checkbox-group" id="items-group">
          ${q.items
            .map(
              (item, i) => `
            <label class="checkbox-label" data-item="${i}">
              <input type="checkbox" data-index="${i}" ${reponsesQuestion[i] ? 'checked' : ''} />
              <span>${item.texte}</span>
            </label>
          `
            )
            .join('')}
        </div>

        <div class="import-actions" id="question-actions"></div>
        <div id="correction-question" class="correction hidden"></div>
      </div>
    </div>
  `

  const checkboxes = document.querySelectorAll('#items-group input[type="checkbox"]')
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', (e) => {
      state.reponses[state.index][parseInt(e.target.dataset.index, 10)] = e.target.checked
    })
  })

  const actionsEl = document.getElementById('question-actions')

  function renderActions() {
    const estCorrigee = state.corrigees[state.index]
    const estDerniere = state.index === qcm.questions.length - 1
    let html = ''

    if (mode === 'entrainement') {
      if (!estCorrigee) {
        html += `<button id="valider-btn" class="btn primary" style="width: auto;">Valider cette question</button>`
      } else {
        html += estDerniere
          ? `<button id="finir-btn" class="btn primary" style="width: auto;">Voir le résumé</button>`
          : `<button id="suivant-btn" class="btn primary" style="width: auto;">Question suivante</button>`
      }
    } else {
      if (state.index > 0) html += `<button id="precedent-btn" class="btn" style="width: auto;">Précédent</button>`
      if (!estDerniere) html += `<button id="suivant-btn" class="btn" style="width: auto;">Suivant</button>`
      html += `<button id="finir-btn" class="btn primary" style="width: auto;">Terminer le QCM</button>`
    }

    actionsEl.innerHTML = html

    const validerBtn = document.getElementById('valider-btn')
    if (validerBtn) {
      validerBtn.addEventListener('click', () => {
        state.corrigees[state.index] = true
        afficherCorrectionQuestion(q, state.reponses[state.index])
        sauvegarderProgressionSilencieux(qcm, state)
        renderActions()
      })
    }

    const suivantBtn = document.getElementById('suivant-btn')
    if (suivantBtn) {
      suivantBtn.addEventListener('click', () => {
        figerChrono(state)
        state.index++
        sauvegarderProgressionSilencieux(qcm, state)
        renderQuestion(container, qcm, mode, state)
      })
    }

    const precedentBtn = document.getElementById('precedent-btn')
    if (precedentBtn) {
      precedentBtn.addEventListener('click', () => {
        state.index--
        sauvegarderProgressionSilencieux(qcm, state)
        renderQuestion(container, qcm, mode, state)
      })
    }

    const finirBtn = document.getElementById('finir-btn')
    if (finirBtn) {
      finirBtn.addEventListener('click', () => {
        clearTimerIfAny()
        terminerQcm(container, qcm, mode, state)
      })
    }
  }

  function afficherCorrectionQuestion(question, reponsesItem) {
    checkboxes.forEach((cb, i) => {
      const label = cb.closest('.checkbox-label')
      cb.disabled = true
      if (question.items[i].correct && cb.checked) label.classList.add('ok')
      else if (question.items[i].correct && !cb.checked) label.classList.add('missed')
      else if (!question.items[i].correct && cb.checked) label.classList.add('wrong')
    })

    const pts = scoreQuestion(question.items, reponsesItem)
    const correctionEl = document.getElementById('correction-question')
    correctionEl.classList.remove('hidden')
    correctionEl.innerHTML = `
      <p style="font-weight: 600; margin-bottom: 6px;">${pts} point${pts !== 1 ? 's' : ''} sur cette question</p>
      ${renderCorrectionItems(question, reponsesItem)}
    `
  }

  if (state.corrigees[state.index]) {
    afficherCorrectionQuestion(q, reponsesQuestion)
  }

  renderActions()
}

async function terminerQcm(container, qcm, mode, state) {
  clearTimerIfAny()
  const { score, scoreMax } = scoreQcm(qcm.questions, state.reponses)
  const dureeUtilisee = mode === 'concours' ? qcm.duree_minutes * 60 - Math.max(0, Math.round((state.dateFinPrevue - Date.now()) / 1000)) : null

  try {
    await enregistrerTentativeQcm({
      qcmId: qcm.id,
      mode,
      score,
      scoreMax,
      reponses: state.reponses,
      dureeUtiliseeSecondes: dureeUtilisee,
    })
  } catch (err) {
    console.error('Erreur enregistrement tentative QCM', err)
  }

  try {
    await supprimerProgression(qcm.id)
  } catch (err) {
    console.error('Erreur suppression progression QCM', err)
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Résumé — ${qcm.titre}</h2>
      </div>

      <div class="now-grid" style="grid-template-columns: 1fr; margin-bottom: 24px;">
        <div class="now-cell">
          <div class="label">score</div>
          <div class="value voice">${score} / ${scoreMax}</div>
          <div class="desc">Mode ${mode}${dureeUtilisee !== null ? ` · ${formatTemps(dureeUtilisee)} utilisées` : ''}</div>
        </div>
      </div>

      <div id="correction-detail"></div>

      <div class="import-actions" style="margin-top: 20px;">
        <a href="#qcm-jouer/${qcm.id}" class="btn primary" style="width: auto;">Refaire ce QCM</a>
        <a href="#qcm" class="btn" style="width: auto;">Retour aux QCM</a>
      </div>
    </div>
  `

  const detailEl = document.getElementById('correction-detail')
  detailEl.innerHTML = qcm.questions
    .map((q, i) => {
      const reponsesQuestion = state.reponses[i]
      const pts = scoreQuestion(q.items, reponsesQuestion)
      return `
      <div class="detail-section">
        <h3 class="voice">Question ${i + 1} — ${pts} pt${pts !== 1 ? 's' : ''}</h3>
        <p style="margin-bottom: 10px;">${q.enonce}</p>
        ${renderCorrectionItems(q, reponsesQuestion)}
      </div>
    `
    })
    .join('')
}
