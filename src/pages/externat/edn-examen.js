import { getDossierAvecQuestions, getQuestionById } from '../../lib/edn-content.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { afficherLoader } from '../../lib/loader.js'
import { richText, activerInteractionsRichText, activerKatex } from '../../lib/richtext.js'
import { scoreQuestion, ajusterScoreQroc } from '../../lib/edn-scoring.js'
import { enregistrerTentative } from '../../lib/edn-tentatives.js'
import { getTagsErreur } from '../../lib/edn-tags-erreur.js'
import { renderTagsErreurChips, attacherTagsErreurChips } from './tags-erreur-picker.js'
import {
  ordonnerPropositions,
  reponseInitiale,
  renderZoneReponse,
  attacherInteractions,
  renderEtVerrouillerCorrection,
  attacherAjustementQroc,
} from './question-engine.js'

// Mode examen (§8 lot 6) : compte à rebours GLOBAL (pas par question), aucune correction avant la
// fin, soumission forcée à zéro. Un dossier est éclaté en questions individuelles pour l'examen
// (chrono unique sur tout l'ensemble), mais chaque groupe garde son "origine" (dossier ou question
// isolée) pour n'enregistrer qu'UNE tentative par origine à la fin, exactement comme en
// entraînement (edn-dossier.js/edn-question.js) — jamais une tentative par question de dossier.
let ciblesInitiales = []
let dureeMinutesInitiale = 60
let simulateurUnessInitial = false

export function demarrerExamenExterne(cibles, dureeMinutes, simulateurUness) {
  ciblesInitiales = cibles
  dureeMinutesInitiale = dureeMinutes
  simulateurUnessInitial = simulateurUness
  window.location.hash = '#edn-examen'
}

function formatChrono(secondes) {
  const s = Math.max(0, secondes)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export async function renderEdnExamen(container) {
  if (ciblesInitiales.length === 0) {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">Examen</h2></div>
        <p class="empty-note">Aucun examen en cours. Lance-en un depuis la Banque ("Lancer un examen").</p>
        <a href="#edn-banque" class="btn primary" style="width: auto;">Banque</a>
      </div>
    `
    return
  }

  const arreterLoader = afficherLoader(container)

  let unites
  try {
    unites = await resoudreUnites(ciblesInitiales)
  } catch (err) {
    arreterLoader()
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Examen</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }
  arreterLoader()

  if (unites.length === 0) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Aucune question résolue pour cet examen.</p></div>`
    ciblesInitiales = []
    return
  }

  const dureeS = dureeMinutesInitiale * 60
  const simulateurUness = simulateurUnessInitial

  const state = {
    index: 0,
    reponses: unites.map((u) => reponseInitiale(u.question.format)),
    propositions: unites.map((u) => ordonnerPropositions(u.question)),
    debutMs: Date.now(),
    finPrevueMs: Date.now() + dureeS * 1000,
  }

  let timerInterval = null

  async function resoudreUnites(cibles) {
    const resultat = []
    for (const c of cibles) {
      const [type, id] = c.cible.split(':')
      if (type === 'd') {
        const dossier = await getDossierAvecQuestions(id)
        ;(dossier.questions || []).forEach((q) => {
          resultat.push({ origineCible: c.cible, origineItems: dossier.items || [], dossierVignette: dossier.vignette, question: q })
        })
      } else {
        const question = await getQuestionById(id)
        resultat.push({ origineCible: c.cible, origineItems: question.items || [], dossierVignette: null, question })
      }
    }
    return resultat
  }

  function classeConteneur() {
    return `wrap${simulateurUness ? ' simulateur-uness' : ''}`
  }

  function renderQuestionCourante() {
    clearInterval(timerInterval)
    const i = state.index
    const u = unites[i]
    const propositions = state.propositions[i]
    const estDerniere = i === unites.length - 1

    container.innerHTML = `
      <div class="${classeConteneur()}">
        <div class="section-head">
          <h2 class="voice">Examen</h2>
          <span class="voice" id="examen-chrono" style="font-size: 20px;">${formatChrono(Math.round((state.finPrevueMs - Date.now()) / 1000))}</span>
        </div>
        <div class="edn-progress">
          ${unites.map((_, idx) => `<div class="edn-progress-segment ${idx <= i ? 'rempli' : ''}"></div>`).join('')}
        </div>
        <p class="import-hint">Question ${i + 1} / ${unites.length} — aucune correction ne sera montrée avant la fin.</p>

        ${u.dossierVignette ? `<div class="cas-card" style="margin-bottom: 16px;"><p class="cas-situation">${richText(u.dossierVignette)}</p></div>` : ''}

        <div class="cas-card">
          <p class="cas-situation">${richText(u.question.enonce)}</p>
          ${u.question.image ? `<div class="qcm-question-image"><img src="${escapeHtml(u.question.image)}" alt="" /></div>` : ''}
          <div id="zone-reponse">${renderZoneReponse(u.question, propositions)}</div>
          <div class="import-actions" id="question-actions">
            <button id="suivant-btn" class="btn primary" style="width: auto;">${estDerniere ? 'Terminer l’examen' : 'Question suivante'} <kbd class="kbd-hint">↵</kbd></button>
          </div>
        </div>
      </div>
    `

    const wrap = container.querySelector('.wrap')
    activerInteractionsRichText(wrap)
    activerKatex(wrap)
    attacherInteractions(wrap, u.question, {
      get reponse() { return state.reponses[i] },
      set reponse(v) { state.reponses[i] = v },
    })

    document.getElementById('suivant-btn').addEventListener('click', avancer)

    demarrerTimer()
  }

  function demarrerTimer() {
    clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      const chronoEl = document.getElementById('examen-chrono')
      if (!chronoEl) {
        clearInterval(timerInterval)
        return
      }
      const restant = Math.round((state.finPrevueMs - Date.now()) / 1000)
      chronoEl.textContent = formatChrono(restant)
      if (restant <= 0) {
        clearInterval(timerInterval)
        terminerExamen()
      }
    }, 500)
  }

  function avancer() {
    clearInterval(timerInterval)
    if (state.index < unites.length - 1) {
      state.index++
      renderQuestionCourante()
    } else {
      terminerExamen()
    }
  }

  async function terminerExamen() {
    clearInterval(timerInterval)
    unites.forEach((u, i) => {
      u.score = scoreQuestion(u.question, state.reponses[i])
    })
    renderRevueEtBilan()
  }

  // Revue (§5.10 : correction affichée seulement à la fin en mode examen) — un tag d'erreur est
  // proposable par origine en tort (dossier ou question), jamais obligatoire (§7.4 : "désactivé en
  // mode examen, où il est proposé au bilan de fin").
  function renderRevueEtBilan() {
    container.innerHTML = `
      <div class="${classeConteneur()}">
        <div class="section-head"><h2 class="voice">Examen — correction</h2></div>
        <div id="revue-liste"></div>
        <div class="import-actions" style="margin-top: 20px;">
          <button id="enregistrer-examen-btn" class="btn primary" style="width: auto;">Enregistrer et terminer</button>
        </div>
      </div>
    `

    const revueEl = document.getElementById('revue-liste')
    unites.forEach((u, i) => {
      const bloc = document.createElement('div')
      bloc.className = 'cas-card'
      bloc.style.marginBottom = '16px'
      // "#zone-reponse"/"#correction-zone" : ids attendus tels quels par renderEtVerrouillerCorrection
      // (question-engine.js, jamais paramétrés par un suffixe) — répétés une fois par bloc de la
      // revue, mais querySelector(container) reste scopé au sous-arbre de CE bloc, donc chaque
      // question retrouve bien SA PROPRE zone malgré l'id dupliqué document-wide (HTML invalide
      // mais sans conséquence ici, aucune de ces pages n'affiche jamais deux questions à la fois
      // ailleurs dans l'app).
      bloc.innerHTML = `<p class="cas-situation">${richText(u.question.enonce)}</p><div id="zone-reponse">${renderZoneReponse(u.question, state.propositions[i])}</div><div id="correction-zone" class="correction hidden"></div>`
      revueEl.appendChild(bloc)
      activerInteractionsRichText(bloc)
      activerKatex(bloc)
      renderEtVerrouillerCorrection(bloc, u.question, state.propositions[i], state.reponses[i], u.score)
      activerKatex(bloc)
      if (u.question.format === 'QROC') {
        attacherAjustementQroc(bloc, (ajustement) => {
          u.score = ajusterScoreQroc(u.score, ajustement)
        })
      }
    })

    const wrap = container.querySelector('.wrap')
    activerKatex(wrap)

    document.getElementById('enregistrer-examen-btn').addEventListener('click', renderChoixTagsPuisEnregistrer)
  }

  // Un seul choix de tags pour tout l'examen (appliqué à chaque origine ratée) plutôt qu'un
  // sélecteur par origine : "proposé au bilan" (§7.4) sans réintroduire la complexité d'un choix
  // par dossier/question, qui n'apporte pas grand-chose à ce stade (l'examen entier partage déjà
  // un seul contexte de révision).
  async function renderChoixTagsPuisEnregistrer() {
    const uneErreurAuMoins = unites.some((u) => u.score < 1)
    let tags = []
    if (uneErreurAuMoins) {
      try {
        tags = await getTagsErreur()
      } catch {
        tags = []
      }
    }

    if (tags.length === 0) {
      await enregistrerToutesLesOrigines([])
      return
    }

    container.innerHTML = `
      <div class="${classeConteneur()}">
        <div class="section-head"><h2 class="voice">Qualifie tes erreurs (optionnel)</h2></div>
        <p class="import-hint">S'applique à toutes les erreurs de cet examen.</p>
        ${renderTagsErreurChips(tags)}
        <div class="import-actions" style="margin-top: 16px;">
          <button id="continuer-bilan-btn" class="btn primary" style="width: auto;">Continuer</button>
        </div>
      </div>
    `

    let tagsChoisis = []
    attacherTagsErreurChips(container.querySelector('.wrap'), (selectionnes) => {
      tagsChoisis = selectionnes
    })

    document.getElementById('continuer-bilan-btn').addEventListener('click', () => enregistrerToutesLesOrigines(tagsChoisis))
  }

  async function enregistrerToutesLesOrigines(tagsChoisis) {
    const parOrigine = new Map()
    unites.forEach((u, i) => {
      if (!parOrigine.has(u.origineCible)) parOrigine.set(u.origineCible, { reponses: [], scores: [], items: u.origineItems })
      parOrigine.get(u.origineCible).reponses.push(state.reponses[i])
      parOrigine.get(u.origineCible).scores.push(u.score)
    })

    const dureeTotaleS = Math.round((Date.now() - state.debutMs) / 1000)
    for (const [origineCible, groupe] of parOrigine) {
      const rate = groupe.scores.some((s) => s < 1)
      try {
        await enregistrerTentative({
          cible: origineCible,
          mode: 'examen',
          reponses: groupe.reponses,
          score: groupe.scores.reduce((a, b) => a + b, 0),
          scoreMax: groupe.scores.length,
          detail: groupe.scores,
          dureeS: dureeTotaleS,
          tagsErreur: rate ? tagsChoisis : [],
          itemsNumeros: groupe.items,
        })
      } catch (err) {
        console.error('Erreur enregistrement tentative examen', err)
      }
    }

    const scoreTotal = unites.reduce((a, u) => a + u.score, 0)
    ciblesInitiales = []
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">Examen terminé</h2></div>
        <div class="now-grid" style="grid-template-columns: 1fr; margin-bottom: 24px;">
          <div class="now-cell">
            <div class="label">score</div>
            <div class="value voice">${scoreTotal} / ${unites.length}</div>
            <div class="desc">${unites.length} question${unites.length !== 1 ? 's' : ''}</div>
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
