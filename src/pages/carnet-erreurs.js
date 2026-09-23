import { getTentativesRatees, getTentativesRevues, marquerCommeRevu, marquerCommeNonRevu, deleteTentative, GABARITS_CAS } from '../lib/cas.js'
import { demanderConfirmation } from '../lib/confirmer.js'
import { escapeHtml } from '../lib/escape.js'
import {
  getQcmTentativesARevoir,
  getQcmTentativesRevues,
  marquerTentativeQcmRevue,
  marquerTentativeQcmNonRevue,
  deleteTentativeQcm,
  questionsRateesDeLaTentative,
} from '../lib/qcm.js'
import { getMatieres, buildMatiereColorMap, couleurTab, getTousLesCoursAplatis } from '../lib/matieres.js'
import { renderTagFilters } from './tag-filter.js'
import { renderTagPicker } from './tag-picker.js'
import { definirScopeRetry } from './qcm-retry-session.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

const PAGE_SIZE = 5

let modeActuel = 'actives'

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

// Un seul rendu de ligne de correction, réutilisé pour les cas et les QCM : vert = coché et
// correct, orange = correct mais oublié (pas coché), rouge = coché à tort.
function ligneCorrection(texte, correct, coche, explication) {
  let classe = 'item-explication-neutre'
  let symbole = '—'
  if (correct && coche) {
    classe = 'item-explication-ok'
    symbole = '✔'
  } else if (correct && !coche) {
    classe = 'item-explication-missed'
    symbole = '✘ manqué'
  } else if (!correct && coche) {
    classe = 'item-explication-wrong'
    symbole = '✘ erreur'
  }
  return `<li class="${classe}"><span class="item-explication-symbole">${symbole}</span> <strong>${texte}</strong>${explication ? ` — ${explication}` : ''}</li>`
}

export async function renderCarnetErreurs(container) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Carnet d'erreurs</h2>
        <span class="count" id="erreurs-count"></span>
      </div>

      <div class="filters" style="margin-bottom: 20px;">
        <button class="filter-btn ${modeActuel === 'actives' ? 'active' : ''}" data-mode="actives">Erreurs actives</button>
        <button class="filter-btn ${modeActuel === 'archive' ? 'active' : ''}" data-mode="archive">Archive</button>
      </div>

      <div id="erreurs-mode-content"></div>
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

  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === modeActuel) return
      modeActuel = btn.dataset.mode
      renderCarnetErreurs(container)
    })
  })

  const modeContent = document.getElementById('erreurs-mode-content')
  if (modeActuel === 'archive') {
    await renderArchive(modeContent)
  } else {
    await renderActives(modeContent)
  }
}

async function renderActives(container) {
  container.innerHTML = `<p class="voice">Chargement…</p>`

  let tentatives, tentativesQcm
  try {
    ;[tentatives, tentativesQcm] = await Promise.all([getTentativesRatees(), getQcmTentativesARevoir()])
  } catch (err) {
    container.innerHTML = `<p class="empty-note">Erreur : ${escapeHtml(err.message)}</p>`
    return
  }

  let matiereColorMap = {}
  try {
    matiereColorMap = buildMatiereColorMap(await getMatieres({}))
  } catch {
    matiereColorMap = {}
  }

  container.innerHTML = `
    <input type="text" id="search-input" class="search-input" placeholder="Rechercher dans les erreurs (matière, question, titre)…" />

    <div class="filters" id="filters-row">
      <select id="cours-filter" class="periode-select"></select>
      <select id="tri-select" class="periode-select">
        <option value="recent">Plus récent</option>
        <option value="ancien">Plus ancien</option>
        <option value="matiere">Matière (A→Z)</option>
      </select>
    </div>

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
  `

  let limiteCas = PAGE_SIZE
  let limiteQcm = PAGE_SIZE
  let activeTags = []
  let activeCours = ''
  let tri = 'recent'

  function trier(list, matiereDe) {
    const copie = [...list]
    if (tri === 'recent') copie.sort((a, b) => new Date(b.date_tentative) - new Date(a.date_tentative))
    else if (tri === 'ancien') copie.sort((a, b) => new Date(a.date_tentative) - new Date(b.date_tentative))
    else if (tri === 'matiere') copie.sort((a, b) => matiereDe(a).localeCompare(matiereDe(b)))
    return copie
  }

  function applyFiltre() {
    const terme = document.getElementById('search-input').value.toLowerCase()

    const casFiltres = trier(
      tentatives.filter((t) => {
        const cas = t.cas_cliniques
        if (!cas) return false
        const matchesTerme = !terme || cas.question.toLowerCase().includes(terme) || cas.matiere.toLowerCase().includes(terme)
        const matchesTags = activeTags.length === 0 || activeTags.some((tag) => (cas.tags || []).includes(tag))
        const matchesCours = !activeCours || cas.cours === activeCours
        return matchesTerme && matchesTags && matchesCours
      }),
      (t) => t.cas_cliniques.matiere
    )

    const qcmFiltres = trier(
      tentativesQcm.filter((t) => {
        const qcm = t.qcm
        if (!qcm) return false
        const matchesTerme =
          !terme ||
          qcm.titre.toLowerCase().includes(terme) ||
          (qcm.matieres || []).some((m) => m.toLowerCase().includes(terme))
        const matchesTags = activeTags.length === 0 || activeTags.some((tag) => (qcm.tags || []).includes(tag))
        const matchesCours = !activeCours || qcm.cours === activeCours
        return matchesTerme && matchesTags && matchesCours
      }),
      (t) => (t.qcm.matieres || []).join(', ')
    )

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

  document.getElementById('tri-select').addEventListener('change', (e) => {
    tri = e.target.value
    applyFiltre()
  })

  try {
    const tousLesCours = await getTousLesCoursAplatis()
    const coursSelect = document.getElementById('cours-filter')
    coursSelect.innerHTML =
      `<option value="">Tous cours</option>` + tousLesCours.map((c) => `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.chemin)}</option>`).join('')
    coursSelect.addEventListener('change', (e) => {
      activeCours = e.target.value
      limiteCas = PAGE_SIZE
      limiteQcm = PAGE_SIZE
      applyFiltre()
    })
  } catch {
    // silencieux : le filtre cours reste optionnel
  }

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
            <div class="tab" style="background: ${couleurTab(cas.matiere, cas.type, matiereColorMap)};"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${escapeHtml(cas.question)}</span>
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
        const nbRatees = questionsRateesDeLaTentative(qcm, t).length

        return `
          <div class="fiche-row">
            <div class="tab" style="background: ${couleurTab(qcm.matieres, null, matiereColorMap)};"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${escapeHtml(qcm.titre)}</span>
                <span class="type-label">${taux}%</span>
              </div>
              <div class="fiche-meta">${(qcm.matieres || []).join(', ')} · fait le ${formatDate(t.date_tentative)} · ${t.score}/${t.score_max} (${t.mode}) · ${nbRatees} question${nbRatees !== 1 ? 's' : ''} ratée${nbRatees !== 1 ? 's' : ''}</div>
              <div class="import-actions" style="margin-top: 10px;">
                <button class="btn primary" data-detail-qcm="${t.id}" style="width: auto;">Voir le détail</button>
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

  function afficherDetailCas(t) {
    const cas = t.cas_cliniques
    const gabarit = GABARITS_CAS[cas.type] || GABARITS_CAS.clinique
    const items = (cas.reponse_attendue && cas.reponse_attendue[gabarit.itemsKey]) || []
    const resultats = (cas.reponse_attendue && cas.reponse_attendue[gabarit.resultKey]) || []
    const reponseDonnee = t.reponse_donnee || []

    const html = `
      <p style="margin-bottom: 12px;">${escapeHtml(cas.question)}</p>
      <p style="font-size: 12px; color: var(--text-faint); margin-bottom: 6px;">${gabarit.itemsLabel}</p>
      <ul class="detail-list">
        ${items.map((item, i) => ligneCorrection(item.label, item.correct, reponseDonnee[i])).join('')}
      </ul>
      ${resultats.length ? `<p style="font-size: 12px; color: var(--text-faint); margin: 12px 0 6px;">${gabarit.resultLabel}</p><ul class="detail-list">${resultats.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
    `
    ouvrirModal(cas.question, html)
  }

  function afficherDetailQcm(t) {
    const qcm = t.qcm
    const reponses = t.reponses || []
    const indicesRates = questionsRateesDeLaTentative(qcm, t)
    let filtreVue = 'toutes'

    function questionsARendre() {
      return filtreVue === 'erreurs' ? indicesRates.map((i) => i) : qcm.questions.map((_, i) => i)
    }

    function rendreQuestions() {
      const indices = questionsARendre()
      if (indices.length === 0) {
        return `<p class="empty-note">Aucune question ratée sur cette tentative.</p>`
      }
      return indices
        .map((i) => {
          const q = qcm.questions[i]
          const reponsesQuestion = reponses[i] || []
          return `
          <div class="detail-section">
            <h3 class="voice" style="font-size: 14px;">Question ${i + 1}</h3>
            <p style="margin-bottom: 8px; font-size: 13px;">${q.enonce}</p>
            <ul class="detail-list">
              ${q.items.map((item, j) => ligneCorrection(item.texte, item.correct, reponsesQuestion[j], item.explication || q.explication)).join('')}
            </ul>
          </div>
        `
        })
        .join('')
    }

    const matieres = qcm.matieres || []

    const html = `
      <div class="settings-card" style="margin-bottom: 18px;">
        <h3 class="voice">Refaire les questions ratées</h3>
        <p class="settings-desc">${indicesRates.length} question${indicesRates.length !== 1 ? 's' : ''} ratée${indicesRates.length !== 1 ? 's' : ''} sur cette dernière tentative.</p>
        <div class="import-actions" style="flex-wrap: wrap;">
          <button class="btn primary" id="retry-ce-qcm-btn" style="width: auto;">Uniquement ce QCM</button>
          ${
            matieres.length > 0
              ? `<button class="btn" id="retry-matiere-btn" style="width: auto;">Toute la matière${matieres.length > 1 ? ' :' : ` (${matieres[0]})`}</button>`
              : ''
          }
          ${matieres.length > 1 ? `<select id="retry-matiere-select" class="periode-select">${matieres.map((m) => `<option value="${m}">${m}</option>`).join('')}</select>` : ''}
        </div>
        <div style="margin-top: 12px;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Ou par tag(s)</label>
          <div id="retry-tags-picker"></div>
          <button class="btn" id="retry-tags-btn" style="width: auto; margin-top: 8px;">Refaire ces tags</button>
        </div>
      </div>

      <div class="filters" style="margin-bottom: 14px;">
        <button class="filter-btn ${filtreVue === 'toutes' ? 'active' : ''}" data-filtre-vue="toutes">Toutes les questions</button>
        <button class="filter-btn ${filtreVue === 'erreurs' ? 'active' : ''}" data-filtre-vue="erreurs">Uniquement les erreurs</button>
      </div>

      <div id="detail-questions">${rendreQuestions()}</div>
    `
    ouvrirModal(qcm.titre, html)

    document.querySelectorAll('[data-filtre-vue]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filtreVue = btn.dataset.filtreVue
        document.querySelectorAll('[data-filtre-vue]').forEach((b) => b.classList.toggle('active', b.dataset.filtreVue === filtreVue))
        document.getElementById('detail-questions').innerHTML = rendreQuestions()
      })
    })

    let tagsChoisis = []
    renderTagPicker(document.getElementById('retry-tags-picker'), {
      selected: tagsChoisis,
      onChange: (tags) => {
        tagsChoisis = tags
      },
    })

    document.getElementById('retry-ce-qcm-btn').addEventListener('click', () => {
      definirScopeRetry({ criteres: { qcmId: qcm.id }, label: qcm.titre })
      window.location.hash = '#qcm-retry-session'
    })

    const retryMatiereBtn = document.getElementById('retry-matiere-btn')
    if (retryMatiereBtn) {
      retryMatiereBtn.addEventListener('click', () => {
        const select = document.getElementById('retry-matiere-select')
        const matiere = select ? select.value : matieres[0]
        definirScopeRetry({ criteres: { matiere }, label: matiere })
        window.location.hash = '#qcm-retry-session'
      })
    }

    document.getElementById('retry-tags-btn').addEventListener('click', () => {
      if (tagsChoisis.length === 0) return
      definirScopeRetry({ criteres: { tags: tagsChoisis }, label: tagsChoisis.join(', ') })
      window.location.hash = '#qcm-retry-session'
    })
  }

  applyFiltre()
}

async function renderArchive(container) {
  container.innerHTML = `<p class="voice">Chargement…</p>`

  let tentatives, tentativesQcm
  try {
    ;[tentatives, tentativesQcm] = await Promise.all([getTentativesRevues(), getQcmTentativesRevues()])
  } catch (err) {
    container.innerHTML = `<p class="empty-note">Erreur : ${escapeHtml(err.message)}</p>`
    return
  }

  let matiereColorMap = {}
  try {
    matiereColorMap = buildMatiereColorMap(await getMatieres({}))
  } catch {
    matiereColorMap = {}
  }

  container.innerHTML = `
    <p class="settings-desc" style="margin-bottom: 16px;">Erreurs déjà marquées comme revues. Elles restent ici tant que tu ne les supprimes pas toi-même, ou jusqu'à une nouvelle tentative réussie.</p>

    <input type="text" id="archive-search-input" class="search-input" placeholder="Rechercher dans l'archive (matière, question, titre)…" />

    <div class="filters" id="archive-filters-row">
      <select id="archive-cours-filter" class="periode-select"></select>
      <select id="archive-tri-select" class="periode-select">
        <option value="recent">Plus récent</option>
        <option value="ancien">Plus ancien</option>
        <option value="matiere">Matière (A→Z)</option>
      </select>
    </div>

    <div class="section-head" style="margin-top: 8px; border-bottom: none; padding-bottom: 0;">
      <h3 class="voice" style="font-size: 15px;">Cas cliniques</h3>
    </div>
    <div id="archive-cas-list" class="fiches-list" style="margin-bottom: 32px;"></div>

    <div class="section-head" style="border-bottom: none; padding-bottom: 0;">
      <h3 class="voice" style="font-size: 15px;">QCM</h3>
    </div>
    <div id="archive-qcm-list" class="fiches-list"></div>
  `

  let activeCours = ''
  let tri = 'recent'

  function trier(list, matiereDe) {
    const copie = [...list]
    if (tri === 'recent') copie.sort((a, b) => new Date(b.date_tentative) - new Date(a.date_tentative))
    else if (tri === 'ancien') copie.sort((a, b) => new Date(a.date_tentative) - new Date(b.date_tentative))
    else if (tri === 'matiere') copie.sort((a, b) => matiereDe(a).localeCompare(matiereDe(b)))
    return copie
  }

  function applyFiltre() {
    const terme = document.getElementById('archive-search-input').value.toLowerCase()

    const casFiltres = trier(
      tentatives.filter((t) => {
        const cas = t.cas_cliniques
        if (!cas) return false
        const matchesTerme = !terme || cas.question.toLowerCase().includes(terme) || cas.matiere.toLowerCase().includes(terme)
        const matchesCours = !activeCours || cas.cours === activeCours
        return matchesTerme && matchesCours
      }),
      (t) => t.cas_cliniques.matiere
    )

    const qcmFiltres = trier(
      tentativesQcm.filter((t) => {
        const qcm = t.qcm
        if (!qcm) return false
        const matchesTerme = !terme || qcm.titre.toLowerCase().includes(terme) || (qcm.matieres || []).some((m) => m.toLowerCase().includes(terme))
        const matchesCours = !activeCours || qcm.cours === activeCours
        return matchesTerme && matchesCours
      }),
      (t) => (t.qcm.matieres || []).join(', ')
    )

    document.getElementById('erreurs-count').textContent = `${casFiltres.length + qcmFiltres.length} au total`
    renderListCas(casFiltres)
    renderListQcm(qcmFiltres)
  }

  document.getElementById('archive-search-input').addEventListener('input', applyFiltre)
  document.getElementById('archive-tri-select').addEventListener('change', (e) => {
    tri = e.target.value
    applyFiltre()
  })

  try {
    const tousLesCours = await getTousLesCoursAplatis()
    const coursSelect = document.getElementById('archive-cours-filter')
    coursSelect.innerHTML =
      `<option value="">Tous cours</option>` + tousLesCours.map((c) => `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.chemin)}</option>`).join('')
    coursSelect.addEventListener('change', (e) => {
      activeCours = e.target.value
      applyFiltre()
    })
  } catch {
    // silencieux : le filtre cours reste optionnel
  }

  function renderListCas(list) {
    const casListEl = document.getElementById('archive-cas-list')
    casListEl.innerHTML = list.length
      ? list
          .map(
            (t) => `
        <div class="fiche-row type-${t.cas_cliniques.type}">
          <div class="tab" style="background: ${couleurTab(t.cas_cliniques.matiere, t.cas_cliniques.type, matiereColorMap)};"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${escapeHtml(t.cas_cliniques.question)}</span>
              <span class="type-label">${TYPE_LABELS[t.cas_cliniques.type]}</span>
            </div>
            <div class="fiche-meta">${escapeHtml(t.cas_cliniques.matiere)} · ratée le ${formatDate(t.date_tentative)}</div>
            <div class="import-actions" style="margin-top: 10px;">
              <a href="#entrainement/${t.cas_cliniques.id}" class="btn primary" style="width: auto;">Rejouer le cas</a>
              <button class="btn" data-restaurer="${t.id}" style="width: auto;">Remettre dans les erreurs actives</button>
              <button class="btn" data-supprimer="${t.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
            </div>
          </div>
        </div>
      `
          )
          .join('')
      : `<p class="empty-note">Aucune erreur archivée ne correspond.</p>`

    casListEl.querySelectorAll('[data-supprimer]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!(await demanderConfirmation('Supprimer définitivement cette entrée archivée ?'))) return
        try {
          await deleteTentative(btn.dataset.supprimer)
          tentatives = tentatives.filter((t) => t.id !== btn.dataset.supprimer)
          applyFiltre()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    casListEl.querySelectorAll('[data-restaurer]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await marquerCommeNonRevu(btn.dataset.restaurer)
          tentatives = tentatives.filter((t) => t.id !== btn.dataset.restaurer)
          applyFiltre()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }

  function renderListQcm(list) {
    const qcmListEl = document.getElementById('archive-qcm-list')
    qcmListEl.innerHTML = list.length
      ? list
          .map((t) => {
            const taux = t.score_max > 0 ? Math.round((t.score / t.score_max) * 100) : 0
            return `
        <div class="fiche-row">
          <div class="tab" style="background: ${couleurTab(t.qcm.matieres, null, matiereColorMap)};"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${escapeHtml(t.qcm.titre)}</span>
              <span class="type-label">${taux}%</span>
            </div>
            <div class="fiche-meta">${escapeHtml((t.qcm.matieres || []).join(', '))} · fait le ${formatDate(t.date_tentative)} · ${t.score}/${t.score_max} (${t.mode})</div>
            <div class="import-actions" style="margin-top: 10px;">
              <button class="btn" data-restaurer-qcm="${t.id}" style="width: auto;">Remettre dans les erreurs actives</button>
              <button class="btn" data-supprimer-qcm="${t.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
            </div>
          </div>
        </div>
      `
          })
          .join('')
      : `<p class="empty-note">Aucun QCM archivé ne correspond.</p>`

    qcmListEl.querySelectorAll('[data-supprimer-qcm]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!(await demanderConfirmation('Supprimer définitivement cette entrée archivée ?'))) return
        try {
          await deleteTentativeQcm(btn.dataset.supprimerQcm)
          tentativesQcm = tentativesQcm.filter((t) => t.id !== btn.dataset.supprimerQcm)
          applyFiltre()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    qcmListEl.querySelectorAll('[data-restaurer-qcm]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await marquerTentativeQcmNonRevue(btn.dataset.restaurerQcm)
          tentativesQcm = tentativesQcm.filter((t) => t.id !== btn.dataset.restaurerQcm)
          applyFiltre()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }

  applyFiltre()
}
