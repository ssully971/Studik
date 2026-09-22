import { getQcmById, updateQcm, deleteQcm } from '../lib/qcm.js'
import { demanderConfirmation } from '../lib/confirmer.js'
import { getMatieres, getCoursAplatis } from '../lib/matieres.js'
import { renderTagPicker } from './tag-picker.js'
import { appliquerSurlignageEnAttente } from '../lib/highlight.js'
import { televerserImage, supprimerImage } from '../lib/images.js'
import { escapeHtml } from '../lib/escape.js'

export async function renderQcmDetail(container, id) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let qcm
  try {
    qcm = await getQcmById(id)
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <a href="#qcm" class="breadcrumb">← QCM</a>

      <div class="detail-header">
        <h1 class="voice" id="qcm-titre-affiche">${escapeHtml(qcm.titre)}</h1>
        <div class="fiche-meta" id="qcm-meta-affiche">${escapeHtml((qcm.matieres || []).join(', ')) || 'Aucune matière'} · ${qcm.duree_minutes} min en concours · ${qcm.questions.length} question${qcm.questions.length !== 1 ? 's' : ''}</div>
        ${qcm.tags.length ? `<div class="tags" id="qcm-tags-affiches">${qcm.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>

      <div class="settings-card" id="qcm-edit-panel" style="margin-bottom: 24px;">
        <div class="section-head" style="border-bottom: none; padding-bottom: 0; margin-bottom: 14px;">
          <h3 class="voice">Fiche d'identité</h3>
          <button id="toggle-edit-btn" class="btn" style="width: auto;">Modifier</button>
        </div>

        <div id="qcm-edit-form" class="hidden">
          <div style="margin-bottom: 14px;">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Titre</label>
            <input type="text" id="edit-titre" class="search-input" style="margin-bottom: 0;" value="${escapeHtml(qcm.titre)}" />
          </div>
          <div style="margin-bottom: 14px;">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Matières (plusieurs possibles)</label>
            <select id="edit-matieres" class="periode-select" multiple size="4" style="width: 100%;"></select>
          </div>
          <div style="margin-bottom: 14px;">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Durée en mode concours (minutes)</label>
            <input type="number" id="edit-duree" class="search-input" style="margin-bottom: 0; max-width: 120px;" value="${qcm.duree_minutes}" />
          </div>
          <div style="margin-bottom: 14px;" id="edit-cours-wrapper">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Cours (optionnel, rattaché à la première matière choisie)</label>
            <select id="edit-cours" class="periode-select" style="width: 100%;"></select>
          </div>
          <div style="margin-bottom: 14px;">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Tags</label>
            <div id="edit-tags-picker"></div>
          </div>
          <div class="import-actions">
            <button id="save-edit-btn" class="btn primary" style="width: auto;">Enregistrer</button>
            <span id="edit-status" class="import-status"></span>
          </div>
        </div>
      </div>

      <div class="import-actions" style="margin-bottom: 24px;">
        <a href="#qcm-jouer/${qcm.id}" class="btn primary" style="width: auto;">Lancer ce QCM</a>
        <button id="delete-qcm-btn" class="btn" style="width: auto; color: #C46A5C;">Supprimer</button>
      </div>

      <div id="qcm-questions-list"></div>
    </div>
  `

  const questionsListEl = document.getElementById('qcm-questions-list')

  function renderQuestions() {
    questionsListEl.innerHTML = qcm.questions
      .map(
        (q, i) => `
        <div class="detail-section">
          <h3 class="voice">Question ${i + 1}</h3>
          <p style="margin-bottom: 10px;">${escapeHtml(q.enonce)}</p>

          ${
            q.image
              ? `<div class="qcm-question-image"><img src="${q.image}" alt="" /></div>
                 <div class="import-actions" style="margin-top: 0;">
                   <button class="btn" data-supprimer-image="${i}" style="width: auto; color: #C46A5C;">Supprimer l'image</button>
                 </div>`
              : `<div class="import-actions" style="margin-top: 0;">
                   <label class="btn" style="width: auto; cursor: pointer;">
                     Ajouter une image
                     <input type="file" accept="image/*" data-ajouter-image="${i}" style="display: none;" />
                   </label>
                 </div>`
          }
          <span class="import-status" data-image-status-question="${i}"></span>

          <ul class="detail-list" style="margin-top: 10px;">
            ${q.items
              .map((item) => `<li>${item.correct ? '✔' : '—'} ${escapeHtml(item.texte)}${item.explication ? ` — <span style="color: var(--text-faint);">${escapeHtml(item.explication)}</span>` : ''}</li>`)
              .join('')}
          </ul>
          ${q.explication ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-faint);">${escapeHtml(q.explication)}</p>` : ''}
        </div>
      `
      )
      .join('')

    questionsListEl.querySelectorAll('[data-ajouter-image]').forEach((input) => {
      input.addEventListener('change', async () => {
        const i = parseInt(input.dataset.ajouterImage, 10)
        const file = input.files[0]
        if (!file) return

        const statusEl = questionsListEl.querySelector(`[data-image-status-question="${i}"]`)
        statusEl.textContent = 'Compression et envoi…'
        statusEl.className = 'import-status'

        try {
          const url = await televerserImage(file)
          const nouvellesQuestions = qcm.questions.map((q, idx) => (idx === i ? { ...q, image: url } : q))
          await updateQcm(qcm.id, { questions: nouvellesQuestions })
          qcm.questions = nouvellesQuestions
          renderQuestions()
        } catch (err) {
          statusEl.textContent = 'Erreur : ' + err.message
          statusEl.className = 'import-status error'
        }
      })
    })

    questionsListEl.querySelectorAll('[data-supprimer-image]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const i = parseInt(btn.dataset.supprimerImage, 10)
        const url = qcm.questions[i].image
        try {
          const nouvellesQuestions = qcm.questions.map((q, idx) => {
            if (idx !== i) return q
            const { image, ...reste } = q
            return reste
          })
          await updateQcm(qcm.id, { questions: nouvellesQuestions })
          qcm.questions = nouvellesQuestions
          renderQuestions()
          await supprimerImage(url)
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }

  renderQuestions()

  appliquerSurlignageEnAttente(container)

  document.getElementById('toggle-edit-btn').addEventListener('click', () => {
    document.getElementById('qcm-edit-form').classList.toggle('hidden')
  })

  async function chargerCours(nomMatiere, coursSelectionne) {
    const wrapper = document.getElementById('edit-cours-wrapper')
    const select = document.getElementById('edit-cours')
    let cours = []
    if (nomMatiere) {
      try {
        cours = await getCoursAplatis(nomMatiere)
      } catch {
        cours = []
      }
    }
    if (cours.length === 0) {
      wrapper.style.display = 'none'
      select.innerHTML = ''
      return
    }
    wrapper.style.display = ''
    select.innerHTML =
      `<option value="">Aucun</option>` +
      cours.map((c) => `<option value="${escapeHtml(c.nom)}" ${c.nom === coursSelectionne ? 'selected' : ''}>${escapeHtml(c.chemin)}</option>`).join('')
  }

  let toutesMatieres = []
  try {
    toutesMatieres = await getMatieres({})
    const select = document.getElementById('edit-matieres')
    select.innerHTML = toutesMatieres
      .map((m) => `<option value="${escapeHtml(m.nom)}" ${qcm.matieres.includes(m.nom) ? 'selected' : ''}>${escapeHtml(m.nom)}</option>`)
      .join('')
    await chargerCours(qcm.matieres[0], qcm.cours)
    select.addEventListener('change', () => {
      const premiere = Array.from(select.selectedOptions).map((o) => o.value)[0]
      chargerCours(premiere, null)
    })
  } catch {
    // silencieux
  }

  let tagsActuels = [...qcm.tags]
  renderTagPicker(document.getElementById('edit-tags-picker'), {
    selected: tagsActuels,
    onChange: (nouveauxTags) => {
      tagsActuels = nouveauxTags
    },
  })

  document.getElementById('save-edit-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('edit-status')
    const titre = document.getElementById('edit-titre').value.trim()
    const matieresSelectionnees = Array.from(document.getElementById('edit-matieres').selectedOptions).map((o) => o.value)
    const duree_minutes = parseInt(document.getElementById('edit-duree').value, 10) || qcm.duree_minutes

    if (!titre) {
      statusEl.textContent = 'Le titre est obligatoire.'
      statusEl.className = 'import-status error'
      return
    }

    const cours = document.getElementById('edit-cours').value || null

    try {
      await updateQcm(qcm.id, { titre, matieres: matieresSelectionnees, duree_minutes, cours, tags: tagsActuels })
      qcm.titre = titre
      qcm.matieres = matieresSelectionnees
      qcm.duree_minutes = duree_minutes
      qcm.cours = cours
      qcm.tags = tagsActuels
      document.getElementById('qcm-titre-affiche').textContent = titre
      document.getElementById('qcm-meta-affiche').textContent =
        `${matieresSelectionnees.join(', ') || 'Aucune matière'} · ${duree_minutes} min en concours · ${qcm.questions.length} question${qcm.questions.length !== 1 ? 's' : ''}`
      statusEl.textContent = 'Enregistré.'
      statusEl.className = 'import-status success'
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.getElementById('delete-qcm-btn').addEventListener('click', async () => {
    if (!(await demanderConfirmation(`Supprimer définitivement le QCM "${qcm.titre}" ? Les tentatives associées resteront dans ton historique.`))) return
    try {
      await deleteQcm(qcm.id)
      window.location.hash = '#qcm'
    } catch (err) {
      alert('Erreur : ' + err.message)
    }
  })
}
