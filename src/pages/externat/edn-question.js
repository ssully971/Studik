import { getQuestionById } from '../../lib/edn-content.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { afficherLoader } from '../../lib/loader.js'
import { richText, activerInteractionsRichText } from '../../lib/richtext.js'
import { scoreQuestion, ajusterScoreQroc } from '../../lib/edn-scoring.js'
import { enregistrerTentative, cibleQuestion } from '../../lib/edn-tentatives.js'
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

// Joueur de questions isolées (§5, §8 lot 3/4). Une question de dossier se joue via #edn-dossier ;
// cette page ne gère que les questions dont dossier_id est null (§4.3 : "on ne révise pas une
// question de DP hors de son dossier"). `contexteSegment` (3e segment de hash) encode le mode de
// jeu quand la question est lancée depuis une session (#edn-session) — voir edn-session.js.
export async function renderEdnQuestion(container, id, contexteSegment) {
  const arreterLoader = afficherLoader(container)

  let question
  try {
    question = await getQuestionById(id)
  } catch (err) {
    arreterLoader()
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Question</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }
  arreterLoader()

  const { enSession, mode } = analyserContexteJeu(contexteSegment)
  const propositions = ordonnerPropositions(question)
  const state = { reponse: reponseInitiale(question.format), score: null, debut: Date.now(), tagsErreur: [] }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">${escapeHtml(question.format)} · rang ${escapeHtml(question.rang)}</h2>
      </div>

      <div class="cas-card">
        <p class="cas-situation">${richText(question.enonce)}</p>
        ${question.image ? `<div class="qcm-question-image"><img src="${escapeHtml(question.image)}" alt="" /></div>` : ''}

        <div id="zone-reponse">${renderZoneReponse(question, propositions)}</div>

        <div class="import-actions" id="question-actions">
          <button id="valider-btn" class="btn primary" style="width: auto;">Valider <kbd class="kbd-hint">Espace</kbd></button>
        </div>
        <div id="correction-zone" class="correction hidden"></div>
      </div>
    </div>
  `

  const wrap = container.querySelector('.wrap')
  activerInteractionsRichText(wrap)
  attacherInteractions(wrap, question, state)

  document.getElementById('valider-btn').addEventListener('click', async () => {
    state.score = scoreQuestion(question, state.reponse)
    renderEtVerrouillerCorrection(wrap, question, propositions, state.reponse, state.score)
    if (question.format === 'QROC') {
      attacherAjustementQroc(wrap, (ajustement) => {
        state.score = ajusterScoreQroc(state.score, ajustement)
      })
    }

    const rate = state.score < 1
    const tagObligatoire = rate && mode === 'entrainement'
    const tags = rate && mode !== 'examen' ? await getTagsErreur() : []

    document.getElementById('question-actions').innerHTML = `
      ${tags.length ? `<p class="import-hint">${tagObligatoire ? "Choisis au moins un tag d'erreur avant de continuer." : "Tag d'erreur (optionnel)."}</p>${renderTagsErreurChips(tags)}` : ''}
      <button id="finir-btn" class="btn primary" style="width: auto;" ${tagObligatoire ? 'disabled' : ''}>Terminer <kbd class="kbd-hint">↵</kbd></button>
    `
    if (tags.length) {
      attacherTagsErreurChips(wrap, (selectionnes) => {
        state.tagsErreur = selectionnes
        document.getElementById('finir-btn').disabled = tagObligatoire && selectionnes.length === 0
      })
    }
    document.getElementById('finir-btn').addEventListener('click', terminer)
  })

  async function terminer() {
    const finirBtn = document.getElementById('finir-btn')
    finirBtn.disabled = true
    try {
      await enregistrerTentative({
        cible: cibleQuestion(question.id),
        mode,
        reponses: state.reponse,
        score: state.score,
        scoreMax: 1,
        dureeS: Math.round((Date.now() - state.debut) / 1000),
        tagsErreur: state.tagsErreur,
        itemsNumeros: question.items || [],
      })
    } catch (err) {
      console.error('Erreur enregistrement tentative EDN', err)
    }
    if (enSession) avancerSessionExternat()
    else window.location.hash = '#edn-banque'
  }
}
