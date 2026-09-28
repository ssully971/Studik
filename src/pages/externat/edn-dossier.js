import { getDossierAvecQuestions } from '../../lib/edn-content.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { richText, activerInteractionsRichText } from '../../lib/richtext.js'
import { scoreQuestion, ajusterScoreQroc } from '../../lib/edn-scoring.js'
import { enregistrerTentative, cibleDossier } from '../../lib/edn-tentatives.js'
import {
  ordonnerPropositions,
  reponseInitiale,
  renderZoneReponse,
  attacherInteractions,
  renderEtVerrouillerCorrection,
  attacherAjustementQroc,
} from './question-engine.js'

function formatTemps(secondes) {
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function renderBarreProgression(index, total) {
  return `
    <div class="edn-progress">
      ${Array.from({ length: total }, (_, i) => `<div class="edn-progress-segment ${i <= index ? 'rempli' : ''}"></div>`).join('')}
    </div>
  `
}

// Joueur de dossiers DP/KFP/TCS (§5.10, §8 lot 3) — règle du "no-back" : une question validée est
// définitivement verrouillée, aucun bouton "précédent" n'existe jamais sur cette page. LCA (écran
// partagé) est hors périmètre de ce lot, voir §8 lot 6.
export async function renderEdnDossier(container, id) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let dossier
  try {
    dossier = await getDossierAvecQuestions(id)
  } catch (err) {
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Dossier</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }

  if (dossier.type === 'LCA') {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">${escapeHtml(dossier.titre)}</h2></div>
        <p class="empty-note">Le joueur LCA (article + questions, écran partagé) arrive au lot 6 (phase 2).</p>
      </div>
    `
    return
  }

  const questions = dossier.questions || []
  if (questions.length === 0) {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">${escapeHtml(dossier.titre)}</h2></div>
        <p class="empty-note">Ce dossier n'a aucune question pour l'instant.</p>
      </div>
    `
    return
  }

  const state = {
    index: 0,
    reponses: questions.map((q) => reponseInitiale(q.format)),
    scores: questions.map(() => null),
    propositionsParQuestion: questions.map((q) => ordonnerPropositions(q)),
    debutDossier: Date.now(),
    debutQuestion: Date.now(),
    dureesQuestions: questions.map(() => 0),
  }

  let timerInterval = null

  function demarrerTimer() {
    clearInterval(timerInterval)
    state.debutQuestion = Date.now()
    timerInterval = setInterval(() => {
      const timerEl = document.getElementById('dossier-timer')
      if (!timerEl) {
        clearInterval(timerInterval)
        return
      }
      timerEl.textContent = formatTemps(Math.floor((Date.now() - state.debutQuestion) / 1000))
    }, 1000)
  }

  function renderQuestionCourante() {
    clearInterval(timerInterval)
    const i = state.index
    const q = questions[i]
    const propositions = state.propositionsParQuestion[i]

    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(dossier.titre)}</h2>
          <span class="count">Question ${i + 1} / ${questions.length} · <span id="dossier-timer">00:00</span></span>
        </div>

        ${renderBarreProgression(i, questions.length)}

        <div class="cas-card" style="margin-bottom: 16px;">
          <p class="cas-situation">${richText(dossier.vignette || '')}</p>
        </div>

        <div class="cas-card">
          <p class="cas-situation">${richText(q.enonce)}</p>
          ${q.image ? `<div class="qcm-question-image"><img src="${escapeHtml(q.image)}" alt="" /></div>` : ''}

          <div id="zone-reponse">${renderZoneReponse(q, propositions)}</div>

          <div class="import-actions" id="question-actions">
            <button id="valider-btn" class="btn primary" style="width: auto;">Valider <kbd class="kbd-hint">Espace</kbd></button>
          </div>
          <div id="correction-zone" class="correction hidden"></div>
        </div>
      </div>
    `

    const wrap = container.querySelector('.wrap')
    activerInteractionsRichText(wrap)
    attacherInteractions(wrap, q, { get reponse() { return state.reponses[i] }, set reponse(v) { state.reponses[i] = v } })
    demarrerTimer()

    document.getElementById('valider-btn').addEventListener('click', () => {
      clearInterval(timerInterval)
      state.dureesQuestions[i] = Math.round((Date.now() - state.debutQuestion) / 1000)
      state.scores[i] = scoreQuestion(q, state.reponses[i])
      renderEtVerrouillerCorrection(wrap, q, propositions, state.reponses[i], state.scores[i])
      if (q.format === 'QROC') {
        attacherAjustementQroc(wrap, (ajustement) => {
          state.scores[i] = ajusterScoreQroc(state.scores[i], ajustement)
        })
      }
      const estDerniere = i === questions.length - 1
      document.getElementById('question-actions').innerHTML = estDerniere
        ? `<button id="finir-btn" class="btn primary" style="width: auto;">Voir le résumé <kbd class="kbd-hint">↵</kbd></button>`
        : `<button id="suivant-btn" class="btn primary" style="width: auto;">Question suivante <kbd class="kbd-hint">↵</kbd></button>`

      document.getElementById('suivant-btn')?.addEventListener('click', () => {
        state.index++
        renderQuestionCourante()
      })
      document.getElementById('finir-btn')?.addEventListener('click', terminerDossier)
    })
  }

  async function terminerDossier() {
    clearInterval(timerInterval)
    const score = state.scores.reduce((a, b) => a + b, 0)
    const scoreMax = questions.length
    const dureeS = Math.round((Date.now() - state.debutDossier) / 1000)

    let enregistre = false
    try {
      await enregistrerTentative({
        cible: cibleDossier(dossier.id),
        mode: 'entrainement',
        reponses: state.reponses,
        score,
        scoreMax,
        detail: state.scores,
        dureeS,
        tagsErreur: [],
      })
      enregistre = true
    } catch (err) {
      console.error('Erreur enregistrement tentative EDN (dossier)', err)
    }

    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">Résumé — ${escapeHtml(dossier.titre)}</h2></div>
        <div class="now-grid" style="grid-template-columns: 1fr; margin-bottom: 24px;">
          <div class="now-cell">
            <div class="label">score</div>
            <div class="value voice">${score} / ${scoreMax}</div>
            <div class="desc">${questions.length} question${questions.length !== 1 ? 's' : ''}${enregistre ? '' : " (non enregistré — erreur réseau)"}</div>
          </div>
        </div>
        <div class="import-actions">
          <a href="#edn-banque" class="btn primary" style="width: auto;">Retour à la banque</a>
        </div>
      </div>
    `
  }

  renderQuestionCourante()
}
