import { getTentativesRatees, marquerCommeRevu } from '../lib/cas.js'
import { getQcmTentativesARevoir, marquerTentativeQcmRevue } from '../lib/qcm.js'
import { renderTagFilters } from './tag-filter.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

const GABARITS_CAS = {
  clinique: { itemsKey: 'signes', resultKey: 'pathologies', itemsLabel: 'Signes', resultLabel: 'Pathologies compatibles' },
  mecanisme: { itemsKey: 'evenements', resultKey: 'consequences', itemsLabel: 'Événements', resultLabel: 'Conséquences attendues' },
  structure: { itemsKey: 'elements', resultKey: 'identification', itemsLabel: 'Éléments', resultLabel: 'À identifier' },
}

const PAGE_SIZE = 5

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ouvrirModal(titre, contenuHtml) {
  const overlay = document.getElementById('detail-modal-overlay')
  document.getElementById('detail-modal-title').textContent = titre
  document.getElementById('detail-modal-content').innerHTML = contenuHtml
  overlay.classList.remove('hidden')
}

export async function renderCarnetErreurs(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let tentatives, tentativesQcm
  try {
    ;[tentatives, tentativesQcm] = await Promise.all([getTentativesRatees(), getQcmTentativesARevoir()])
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Carnet d'erreurs</h2>
        <span class="count" id="erreurs-count"></span>
      </div>

      <input type="text" id="search-input" class="search-input" placeholder="Rechercher dans les erreurs (matière, question, titre)…" />

      <div class="filters" id="tag-filters"></div>

      <div class="section-head" style="margin-top: 8px; border-bottom: none; padding-bottom: 0;">
        <h3 class="voice" style="font-size: 15px;">Cas cliniques</h3>
      </div>
      <div id="erreurs-list" class="fiches-list" style="margin-bottom: 12px;"></div>
      <div id="erreurs-voir-plus" style="margin-bottom: 32px;"></div>

      <div class="section-head" style="border-bottom: none; padding-bottom: 0;">
        <h3 class="voice" style="font-size: 15px;">QCM</h3>
      </div>
      <div id="erreurs-qcm-list" class="fiches-list" style="margin-bottom: 12px;"></div>
      <div id="erreurs-qcm-voir-plus"></div>
    </div>

    <div id="detail-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="detail-modal-title" class="voice"></span>
          <button id="detail-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <div id="detail-modal-content"></div>
      </div>
    </div>
  `

  document.getElementById('detail-modal-close').addEventListener('click', () => {
    document.getElementById('detail-modal-overlay').classList.add('hidden')
  })
  document.getElementById('detail-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal-overlay') e.target.classList.add('hidden')
  })

  let limiteCas = PAGE_SIZE
  let limiteQcm = PAGE_SIZE
  let activeTags = []

  function applyFiltre() {
    const terme = document.getElementById('search-input').value.toLowerCase()

    const casFiltres = tentatives.filter((t) => {
      const cas = t.cas_cliniques
      if (!cas) return false
      const matchesTerme = !terme || cas.question.toLowerCase().includes(terme) || cas.matiere.toLowerCase().includes(terme)
      const matchesTags = activeTags.length === 0 || activeTags.some((tag) => (cas.tags || []).includes(tag))
      return matchesTerme && matchesTags
    })

    const qcmFiltres = tentativesQcm.filter((t) => {
      const qcm = t.qcm
      if (!qcm) return false
      const matchesTerme =
        !terme ||
        qcm.titre.toLowerCase().includes(terme) ||
        (qcm.matieres || []).some((m) => m.toLowerCase().includes(terme))
      const matchesTags = activeTags.length === 0 || activeTags.some((tag) => (qcm.tags || []).includes(tag))
      return matchesTerme && matchesTags
    })

    updateCount(casFiltres.length + qcmFiltres.length)
    renderListCas(casFiltres)
    renderListQcm(qcmFiltres)
  }

  function updateCount(total) {
    document.getElementById('erreurs-count').textContent = `${total} au total`
  }

  document.getElementById('search-input').addEventListener('input', () => {
    limiteCas = PAGE_SIZE
    limiteQcm = PAGE_SIZE
    applyFiltre()
  })

  await renderTagFilters(document.getElementById('tag-filters'), {
    selected: activeTags,
    onChange: (tags) => {
      activeTags = tags
      limiteCas = PAGE_SIZE
      limiteQcm = PAGE_SIZE
      applyFiltre()
    },
  })

  function renderListCas(list) {
    const listEl = document.getElementById('erreurs-list')
    const voirPlusEl = document.getElementById('erreurs-voir-plus')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucune erreur de cas à revoir.</p>`
      voirPlusEl.innerHTML = ''
      return
    }

    const visibles = list.slice(0, limiteCas)

    listEl.innerHTML = visibles
      .map((t) => {
        const cas = t.cas_cliniques
        const fichesLiens = (cas.fiches_liees || [])
          .map((id) => `<a href="#fiche/${id}" class="btn" style="width: auto;">Fiche ${id}</a>`)
          .join('')

        return `
          <div class="fiche-row type-${cas.type}">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${cas.question}</span>
                <span class="type-label">${TYPE_LABELS[cas.type]}</span>
              </div>
              <div class="fiche-meta">${cas.matiere} · ratée le ${formatDate(t.date_tentative)}</div>
              <div class="import-actions" style="margin-top: 10px;">
                <a href="#entrainement/${cas.id}" class="btn primary" style="width: auto;">Rejouer le cas</a>
                <button class="btn" data-detail="${t.id}" style="width: auto;">Voir le détail</button>
                ${fichesLiens}
                <button class="btn" data-revu="${t.id}" style="width: auto;">Marquer comme revu</button>
              </div>
            </div>
          </div>
        `
      })
      .join('')

    voirPlusEl.innerHTML =
      list.length > visibles.length
        ? `<button id="voir-plus-cas-btn" class="btn" style="width: auto;">Voir plus (${list.length - visibles.length} restant${list.length - visibles.length !== 1 ? 's' : ''})</button>`
        : ''

    const voirPlusBtn = document.getElementById('voir-plus-cas-btn')
    if (voirPlusBtn) {
      voirPlusBtn.addEventListener('click', () => {
        limiteCas += PAGE_SIZE
        applyFiltre()
      })
    }

    listEl.querySelectorAll('[data-revu]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tentativeId = btn.dataset.revu
        btn.disabled = true
        btn.textContent = '…'
        try {
          await marquerCommeRevu(tentativeId)
          tentatives = tentatives.filter((t) => t.id !== tentativeId)
          applyFiltre()
        } catch (err) {
          btn.textContent = 'Erreur'
        }
      })
    })

    listEl.querySelectorAll('[data-detail]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = tentatives.find((t) => t.id === btn.dataset.detail)
        if (t) afficherDetailCas(t)
      })
    })
  }

  function afficherDetailCas(t) {
    const cas = t.cas_cliniques
    const gabarit = GABARITS_CAS[cas.type] || GABARITS_CAS.clinique
    const items = (cas.reponse_attendue && cas.reponse_attendue[gabarit.itemsKey]) || []
    const resultats = (cas.reponse_attendue && cas.reponse_attendue[gabarit.resultKey]) || []
    const reponseDonnee = t.reponse_donnee || []

    const html = `
      <p style="margin-bottom: 12px;">${cas.question}</p>
      <p style="font-size: 12px; color: var(--text-faint); margin-bottom: 6px;">${gabarit.itemsLabel}</p>
      <ul class="detail-list">
        ${items
          .map((item, i) => {
            const coche = reponseDonnee[i]
            let symbole = '—'
            if (item.correct && coche) symbole = '✔'
            else if (item.correct && !coche) symbole = '✘ (manqué)'
            else if (!item.correct && coche) symbole = '✘ (erreur)'
            return `<li>${symbole} ${item.label}</li>`
          })
          .join('')}
      </ul>
      ${resultats.length ? `<p style="font-size: 12px; color: var(--text-faint); margin: 12px 0 6px;">${gabarit.resultLabel}</p><ul class="detail-list">${resultats.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
    `
    ouvrirModal(cas.question, html)
  }

  function renderListQcm(list) {
    const listEl = document.getElementById('erreurs-qcm-list')
    const voirPlusEl = document.getElementById('erreurs-qcm-voir-plus')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun QCM à revoir.</p>`
      voirPlusEl.innerHTML = ''
      return
    }

    const visibles = list.slice(0, limiteQcm)

    listEl.innerHTML = visibles
      .map((t) => {
        const qcm = t.qcm
        const taux = t.score_max > 0 ? Math.round((t.score / t.score_max) * 100) : 0

        return `
          <div class="fiche-row">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${qcm.titre}</span>
                <span class="type-label">${taux}%</span>
              </div>
              <div class="fiche-meta">${(qcm.matieres || []).join(', ')} · fait le ${formatDate(t.date_tentative)} · ${t.score}/${t.score_max} (${t.mode})</div>
              <div class="import-actions" style="margin-top: 10px;">
                <a href="#qcm-jouer/${qcm.id}" class="btn primary" style="width: auto;">Refaire le QCM</a>
                <button class="btn" data-detail-qcm="${t.id}" style="width: auto;">Voir le détail</button>
                <button class="btn" data-revu-qcm="${t.id}" style="width: auto;">Marquer comme revu</button>
              </div>
            </div>
          </div>
        `
      })
      .join('')

    voirPlusEl.innerHTML =
      list.length > visibles.length
        ? `<button id="voir-plus-qcm-btn" class="btn" style="width: auto;">Voir plus (${list.length - visibles.length} restant${list.length - visibles.length !== 1 ? 's' : ''})</button>`
        : ''

    const voirPlusBtn = document.getElementById('voir-plus-qcm-btn')
    if (voirPlusBtn) {
      voirPlusBtn.addEventListener('click', () => {
        limiteQcm += PAGE_SIZE
        applyFiltre()
      })
    }

    listEl.querySelectorAll('[data-revu-qcm]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tentativeId = btn.dataset.revuQcm
        btn.disabled = true
        btn.textContent = '…'
        try {
          await marquerTentativeQcmRevue(tentativeId)
          tentativesQcm = tentativesQcm.filter((t) => t.id !== tentativeId)
          applyFiltre()
        } catch (err) {
          btn.textContent = 'Erreur'
        }
      })
    })

    listEl.querySelectorAll('[data-detail-qcm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = tentativesQcm.find((t) => t.id === btn.dataset.detailQcm)
        if (t) afficherDetailQcm(t)
      })
    })
  }

  function afficherDetailQcm(t) {
    const qcm = t.qcm
    const reponses = t.reponses || []

    const html = qcm.questions
      .map((q, i) => {
        const reponsesQuestion = reponses[i] || []
        const itemsAExpliquer = q.items
          .map((item, j) => ({ item, j, coche: reponsesQuestion[j] }))
          .filter(({ item, coche }) => Boolean(coche) !== Boolean(item.correct))

        return `
        <div class="detail-section">
          <h3 class="voice" style="font-size: 14px;">Question ${i + 1}</h3>
          <p style="margin-bottom: 8px; font-size: 13px;">${q.enonce}</p>
          <ul class="detail-list">
            ${q.items
              .map((item, j) => {
                const coche = reponsesQuestion[j]
                let symbole = '—'
                if (item.correct && coche) symbole = '✔'
                else if (item.correct && !coche) symbole = '✘ (manqué)'
                else if (!item.correct && coche) symbole = '✘ (erreur)'
                return `<li>${symbole} ${item.texte}</li>`
              })
              .join('')}
          </ul>
          ${
            itemsAExpliquer.length > 0
              ? `<ul class="detail-list" style="margin-top: 8px;">${itemsAExpliquer
                  .map(({ item }) => {
                    const explication = item.explication || q.explication
                    return explication ? `<li><strong>${item.texte}</strong> — ${explication}</li>` : ''
                  })
                  .join('')}</ul>`
              : ''
          }
        </div>
      `
      })
      .join('')

    ouvrirModal(qcm.titre, html)
  }

  applyFiltre()
}
