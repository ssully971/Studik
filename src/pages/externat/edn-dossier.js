import { getDossierAvecQuestions } from '../../lib/edn-content.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { afficherLoader } from '../../lib/loader.js'
import { richText, activerInteractionsRichText, activerKatex } from '../../lib/richtext.js'
import { scoreQuestion, ajusterScoreQroc } from '../../lib/edn-scoring.js'
import { enregistrerTentative, cibleDossier } from '../../lib/edn-tentatives.js'
import { getTagsErreur } from '../../lib/edn-tags-erreur.js'
import { analyserContexteJeu, avancerSessionExternat } from './edn-session.js'
import { renderTagsErreurChips, attacherTagsErreurChips } from './tags-erreur-picker.js'
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

// Joueur de dossiers DP/KFP/TCS/LCA (§5.10, §8 lots 3 et 6) — règle du "no-back" : une question
// validée est définitivement verrouillée, aucun bouton "précédent" n'existe jamais sur cette page.
// LCA (§8 lot 6) réutilise le même moteur de jeu (zoneQuestionHTML) dans une coquille à écran
// partagé (renderCoquilleLCA) qui ne remplace que la colonne questions à chaque validation, jamais
// l'article, pour ne pas le recharger.
export async function renderEdnDossier(container, id, contexteSegment) {
  const arreterLoader = afficherLoader(container)

  let dossier
  try {
    dossier = await getDossierAvecQuestions(id)
  } catch (err) {
    arreterLoader()
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Dossier</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }
  arreterLoader()

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

  const { enSession, mode } = analyserContexteJeu(contexteSegment)

  const state = {
    index: 0,
    reponses: questions.map((q) => reponseInitiale(q.format)),
    scores: questions.map(() => null),
    propositionsParQuestion: questions.map((q) => ordonnerPropositions(q)),
    debutDossier: Date.now(),
    debutQuestion: Date.now(),
    dureesQuestions: questions.map(() => 0),
    tagsErreur: [],
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

  const estLCA = dossier.type === 'LCA'

  // Carte "question courante" seule (énoncé + zone de réponse + actions + correction) — partagée
  // entre le rendu classique (DP/KFP/TCS, tout le .wrap remplacé) et le rendu LCA (seule la
  // colonne questions est remplacée à chaque validation, jamais l'article : le rechargerait et
  // perdrait le défilement/la position de lecture, voir §5.10 "questions défilantes à droite").
  function zoneQuestionHTML(q, propositions) {
    return `
      <div class="cas-card">
        <p class="cas-situation">${richText(q.enonce)}</p>
        ${q.image ? `<div class="qcm-question-image"><img src="${escapeHtml(q.image)}" alt="" /></div>` : ''}

        <div id="zone-reponse">${renderZoneReponse(q, propositions)}</div>

        <div class="import-actions" id="question-actions">
          <button id="valider-btn" class="btn primary" style="width: auto;">Valider <kbd class="kbd-hint">Espace</kbd></button>
        </div>
        <div id="correction-zone" class="correction hidden"></div>
      </div>
    `
  }

  function renderCoquilleLCA() {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">${escapeHtml(dossier.titre)}</h2>
          <span class="count">Question <span id="lca-position">1</span> / ${questions.length} · <span id="dossier-timer">00:00</span></span>
        </div>

        ${dossier.vignette ? `<p class="import-hint">${richText(dossier.vignette)}</p>` : ''}

        <div id="lca-progression"></div>

        <div class="filters" id="lca-onglets">
          <button class="filter-btn active" data-onglet="article">Article</button>
          <button class="filter-btn" data-onglet="questions">Questions</button>
        </div>

        <div class="edn-lca-desktop">
          <div class="edn-lca-article">
            ${
              dossier.article_url
                ? `<iframe src="${escapeHtml(dossier.article_url)}" class="edn-lca-frame" title="Article"></iframe>
                   <a href="${escapeHtml(dossier.article_url)}" target="_blank" rel="noopener" class="btn" style="width: auto; margin-top: 8px;">Ouvrir l'article dans un nouvel onglet</a>`
                : `<p class="empty-note">Aucun article fourni pour ce dossier.</p>`
            }
          </div>
          <div class="edn-lca-questions" id="lca-question-zone"></div>
        </div>
      </div>
    `

    document.getElementById('lca-onglets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-onglet]')
      if (!btn) return
      document.querySelectorAll('#lca-onglets .filter-btn').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      container.querySelector('.edn-lca-desktop').dataset.ongletMobile = btn.dataset.onglet
    })
    container.querySelector('.edn-lca-desktop').dataset.ongletMobile = 'article'
  }

  function renderQuestionCourante() {
    clearInterval(timerInterval)
    const i = state.index
    const q = questions[i]
    const propositions = state.propositionsParQuestion[i]

    if (estLCA) {
      document.getElementById('lca-position').textContent = String(i + 1)
      document.getElementById('lca-progression').innerHTML = renderBarreProgression(i, questions.length)
      document.getElementById('lca-question-zone').innerHTML = zoneQuestionHTML(q, propositions)
    } else {
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

          ${zoneQuestionHTML(q, propositions)}
        </div>
      `
    }

    const wrap = container.querySelector('.wrap')
    activerInteractionsRichText(wrap)
    activerKatex(wrap)
    attacherInteractions(wrap, q, { get reponse() { return state.reponses[i] }, set reponse(v) { state.reponses[i] = v } })
    demarrerTimer()

    document.getElementById('valider-btn').addEventListener('click', () => {
      clearInterval(timerInterval)
      state.dureesQuestions[i] = Math.round((Date.now() - state.debutQuestion) / 1000)
      state.scores[i] = scoreQuestion(q, state.reponses[i])
      renderEtVerrouillerCorrection(wrap, q, propositions, state.reponses[i], state.scores[i])
      activerKatex(wrap)
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

  // Le tag d'erreur (§7.4) se choisit une seule fois pour tout le dossier (une seule tentative
  // enregistrée à cet échelon, voir DECISIONS.md lot 4), pas question par question.
  async function terminerDossier() {
    clearInterval(timerInterval)
    const rate = state.scores.some((s) => s < 1)
    const tagObligatoire = rate && mode === 'entrainement'
    const tags = rate && mode !== 'examen' ? await getTagsErreur() : []

    if (tags.length > 0) {
      container.innerHTML = `
        <div class="wrap">
          <div class="section-head"><h2 class="voice">Qualifie tes erreurs — ${escapeHtml(dossier.titre)}</h2></div>
          <p class="import-hint">${tagObligatoire ? "Choisis au moins un tag d'erreur avant de continuer." : "Tag d'erreur (optionnel)."}</p>
          ${renderTagsErreurChips(tags)}
          <div class="import-actions" style="margin-top: 16px;">
            <button id="continuer-btn" class="btn primary" style="width: auto;" ${tagObligatoire ? 'disabled' : ''}>Continuer</button>
          </div>
        </div>
      `
      const wrap = container.querySelector('.wrap')
      attacherTagsErreurChips(wrap, (selectionnes) => {
        state.tagsErreur = selectionnes
        document.getElementById('continuer-btn').disabled = tagObligatoire && selectionnes.length === 0
      })
      document.getElementById('continuer-btn').addEventListener('click', enregistrerEtAfficherResume)
    } else {
      await enregistrerEtAfficherResume()
    }
  }

  async function enregistrerEtAfficherResume() {
    const score = state.scores.reduce((a, b) => a + b, 0)
    const scoreMax = questions.length
    const dureeS = Math.round((Date.now() - state.debutDossier) / 1000)

    let enregistre = false
    try {
      await enregistrerTentative({
        cible: cibleDossier(dossier.id),
        mode,
        reponses: state.reponses,
        score,
        scoreMax,
        detail: state.scores,
        dureeS,
        tagsErreur: state.tagsErreur,
        itemsNumeros: dossier.items || [],
      })
      enregistre = true
    } catch (err) {
      console.error('Erreur enregistrement tentative EDN (dossier)', err)
    }

    if (enSession) {
      avancerSessionExternat()
      return
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

  if (estLCA) renderCoquilleLCA()
  renderQuestionCourante()
}
