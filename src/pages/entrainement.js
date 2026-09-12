import { getCasAleatoire, getCasById, enregistrerTentative } from '../lib/cas.js'
import { getMatieres } from '../lib/matieres.js'

let filtreMatiere = ''
let filtreNiveau = ''

const GABARITS = {
  clinique: {
    itemsKey: 'signes',
    resultKey: 'pathologies',
    itemsLabel: 'Tes réponses',
    resultLabel: 'Pathologies compatibles',
  },
  mecanisme: {
    itemsKey: 'evenements',
    resultKey: 'consequences',
    itemsLabel: 'Tes réponses',
    resultLabel: 'Conséquences attendues',
  },
  structure: {
    itemsKey: 'elements',
    resultKey: 'identification',
    itemsLabel: 'Tes réponses',
    resultLabel: 'À identifier',
  },
}

export async function renderEntrainement(container, casId) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Entraînement</h2>
      </div>

      <div class="filters" id="entrainement-filters">
        <select id="filtre-matiere" class="periode-select"></select>
        <select id="filtre-niveau" class="periode-select">
          <option value="">Tous niveaux</option>
          <option value="1">Niveau 1</option>
          <option value="2">Niveau 2</option>
          <option value="3">Niveau 3</option>
        </select>
        <button id="nouveau-cas-btn" class="btn primary" style="width: auto;">Nouveau cas</button>
      </div>

      <div id="cas-container"><p class="voice">Chargement d'un cas…</p></div>
    </div>
  `

  try {
    const matieres = await getMatieres({})
    const select = document.getElementById('filtre-matiere')
    select.innerHTML =
      `<option value="">Toutes matières</option>` +
      matieres.map((m) => `<option value="${m.nom}" ${filtreMatiere === m.nom ? 'selected' : ''}>${m.nom}</option>`).join('')
  } catch {
    // silencieux : le filtre matière reste optionnel
  }

  const niveauSelect = document.getElementById('filtre-niveau')
  niveauSelect.value = filtreNiveau

  document.getElementById('filtre-matiere').addEventListener('change', (e) => {
    filtreMatiere = e.target.value
  })

  document.getElementById('filtre-niveau').addEventListener('change', (e) => {
    filtreNiveau = e.target.value
  })

  document.getElementById('nouveau-cas-btn').addEventListener('click', () => {
    chargerCas()
  })

  await chargerCas(casId)

  async function chargerCas(id) {
    const casContainer = document.getElementById('cas-container')
    casContainer.innerHTML = `<p class="voice">Chargement d'un cas…</p>`

    let cas
    try {
      cas = id
        ? await getCasById(id)
        : await getCasAleatoire({
            matiere: filtreMatiere || undefined,
            niveau: filtreNiveau ? parseInt(filtreNiveau, 10) : undefined,
          })
    } catch (err) {
      casContainer.innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
      return
    }

    if (!cas) {
      casContainer.innerHTML = `<p class="empty-note">Aucun cas ne correspond à ces filtres.</p>`
      return
    }

    renderCas(casContainer, cas)
  }
}

function renderCas(container, cas) {
  const gabarit = GABARITS[cas.type] || GABARITS.clinique
  const items = (cas.reponse_attendue && cas.reponse_attendue[gabarit.itemsKey]) || []
  const resultats = (cas.reponse_attendue && cas.reponse_attendue[gabarit.resultKey]) || []
  const elements = (cas.enonce && cas.enonce.elements) || []

  container.innerHTML = `
    <div class="cas-card">
      <div class="cas-meta-row">${cas.matiere} · ${cas.type} · niveau ${cas.niveau}</div>

      <p class="cas-situation">${cas.enonce.situation || ''}</p>

      ${elements.length ? `<ul class="detail-list">${elements.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}

      <p class="cas-question voice">${cas.question}</p>

      <p style="font-size: 12px; color: var(--text-faint); margin-bottom: 8px;">${gabarit.itemsLabel}</p>
      <div class="checkbox-group" id="items-group">
        ${items
          .map(
            (item, i) => `
          <label class="checkbox-label">
            <input type="checkbox" data-index="${i}" />
            <span>${item.label}</span>
          </label>
        `
          )
          .join('')}
      </div>

      <div class="import-actions">
        <button id="valider-btn" class="btn primary" style="width: auto;">Valider mes réponses</button>
      </div>

      <div id="correction" class="correction hidden"></div>
    </div>
  `

  document.getElementById('valider-btn').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('#items-group input[type="checkbox"]')
    const reponseDonnee = Array.from(checkboxes).map((cb) => cb.checked)

    const tousCorrects = items.every((item, i) => reponseDonnee[i] === item.correct)

    checkboxes.forEach((cb, i) => {
      const label = cb.closest('.checkbox-label')
      if (items[i].correct && cb.checked) label.classList.add('ok')
      else if (items[i].correct && !cb.checked) label.classList.add('missed')
      else if (!items[i].correct && cb.checked) label.classList.add('wrong')
    })

    const correctionEl = document.getElementById('correction')
    correctionEl.classList.remove('hidden')
    correctionEl.innerHTML = `
      <h3 class="voice">${tousCorrects ? 'Bonne réponse' : 'Réponse incomplète ou incorrecte'}</h3>
      ${
        resultats.length
          ? `<div class="detail-section"><h3 class="voice">${gabarit.resultLabel}</h3><ul class="detail-list">${resultats
              .map((r) => `<li>${r}</li>`)
              .join('')}</ul></div>`
          : ''
      }
      <button id="autre-cas-btn" class="btn" style="width: auto;">Un autre cas</button>
    `

    document.getElementById('valider-btn').disabled = true

    document.getElementById('autre-cas-btn').addEventListener('click', () => {
      document.getElementById('nouveau-cas-btn').click()
    })

    try {
      await enregistrerTentative(cas.id, tousCorrects, reponseDonnee)
    } catch (err) {
      console.error('Erreur enregistrement tentative', err)
    }
  })
}
