import { getQuestionsRateesParScope, scoreQuestion } from '../lib/qcm.js'

const CLE_SCOPE_RETRY = 'studik_retry_scope'

export function definirScopeRetry(scope) {
  try {
    sessionStorage.setItem(CLE_SCOPE_RETRY, JSON.stringify(scope))
  } catch {
    // silencieux
  }
}

function consommerScopeRetry() {
  try {
    const raw = sessionStorage.getItem(CLE_SCOPE_RETRY)
    sessionStorage.removeItem(CLE_SCOPE_RETRY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function melanger(array) {
  const copie = [...array]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

export async function renderQcmRetrySession(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  const scope = consommerScopeRetry()
  if (!scope) {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">Questions ratées</h2></div>
        <p class="empty-note">Aucune session en attente. Lance ce mode depuis le carnet d'erreurs.</p>
        <a href="#erreurs" class="btn primary" style="width: auto;">Retour au carnet d'erreurs</a>
      </div>
    `
    return
  }

  let questions
  try {
    questions = await getQuestionsRateesParScope(scope.criteres)
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  if (questions.length === 0) {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">Questions ratées — ${scope.label}</h2></div>
        <p class="empty-note">Aucune question ratée pour ce périmètre.</p>
        <a href="#erreurs" class="btn primary" style="width: auto;">Retour au carnet d'erreurs</a>
      </div>
    `
    return
  }

  const file = melanger(questions)
  const scores = []
  let index = 0

  function afficherQuestion() {
    if (index >= file.length) {
      afficherResume()
      return
    }

    const { question: q, qcmTitre } = file[index]
    const reponses = q.items.map(() => false)

    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">Questions ratées — ${scope.label}</h2>
          <span class="count">${index + 1} / ${file.length}</span>
        </div>

        <div class="cas-card">
          <div class="cas-meta-row">${qcmTitre}</div>
          <p class="cas-situation">${q.enonce}</p>
          ${q.image ? `<div class="qcm-question-image"><img src="${q.image}" alt="" /></div>` : ''}

          <div class="checkbox-group" id="items-group">
            ${q.items
              .map(
                (item, i) => `
              <label class="checkbox-label" data-item="${i}">
                <input type="checkbox" data-index="${i}" />
                <span>${item.texte}</span>
              </label>
            `
              )
              .join('')}
          </div>

          <div class="import-actions" id="question-actions">
            <button id="valider-btn" class="btn primary" style="width: auto;">Valider cette question</button>
          </div>
          <div id="correction-question" class="correction hidden"></div>
        </div>
      </div>
    `

    const checkboxes = document.querySelectorAll('#items-group input[type="checkbox"]')
    checkboxes.forEach((cb) => {
      cb.addEventListener('change', (e) => {
        reponses[parseInt(e.target.dataset.index, 10)] = e.target.checked
      })
    })

    document.getElementById('valider-btn').addEventListener('click', () => {
      checkboxes.forEach((cb, i) => {
        cb.disabled = true
        const label = cb.closest('.checkbox-label')
        if (q.items[i].correct && cb.checked) label.classList.add('ok')
        else if (q.items[i].correct && !cb.checked) label.classList.add('missed')
        else if (!q.items[i].correct && cb.checked) label.classList.add('wrong')
      })

      const pts = scoreQuestion(q.items, reponses)
      scores.push(pts)

      const itemsAExpliquer = q.items
        .map((item, i) => ({ item, coche: reponses[i] }))
        .filter(({ item, coche }) => Boolean(coche) !== Boolean(item.correct))

      const correctionEl = document.getElementById('correction-question')
      correctionEl.classList.remove('hidden')
      correctionEl.innerHTML = `
        <p style="font-weight: 600; margin-bottom: 6px;">${pts} point${pts !== 1 ? 's' : ''} sur cette question</p>
        ${
          itemsAExpliquer.length > 0
            ? `<ul class="detail-list">${itemsAExpliquer
                .map(({ item }) => {
                  const explication = item.explication || q.explication
                  return explication ? `<li><strong>${item.texte}</strong> — ${explication}</li>` : ''
                })
                .join('')}</ul>`
            : ''
        }
      `

      document.getElementById('question-actions').innerHTML =
        index === file.length - 1
          ? `<button id="suivant-btn" class="btn primary" style="width: auto;">Voir le résumé</button>`
          : `<button id="suivant-btn" class="btn primary" style="width: auto;">Question suivante</button>`

      document.getElementById('suivant-btn').addEventListener('click', () => {
        index++
        afficherQuestion()
      })
    })
  }

  function afficherResume() {
    const total = scores.reduce((s, p) => s + p, 0)
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head"><h2 class="voice">Session terminée — ${scope.label}</h2></div>
        <p class="settings-desc">${total} / ${file.length} points sur ${file.length} question${file.length !== 1 ? 's' : ''} rejouées.</p>
        <p class="settings-desc">Ce mode ne crée pas de nouvelle tentative permanente — retente ce périmètre autant de fois que tu veux depuis le carnet d'erreurs.</p>
        <a href="#erreurs" class="btn primary" style="width: auto;">Retour au carnet d'erreurs</a>
      </div>
    `
  }

  afficherQuestion()
}
