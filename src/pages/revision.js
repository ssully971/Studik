import { getFichesARevoir, updateStatut } from '../lib/fiches.js'
import { getPeriodeActuelle } from '../lib/periode.js'
import { renderTagFilters } from './tag-filter.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

export async function renderRevision(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let allFiches
  try {
    const periode = getPeriodeActuelle()
    allFiches = await getFichesARevoir(periode ? { annee: periode.annee, semestre: periode.semestre } : {})
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Révision</h2>
        <span class="count" id="revision-count"></span>
      </div>

      <div class="filters" id="type-filters">
        <button class="filter-btn active" data-type="">Tous</button>
        <button class="filter-btn" data-type="clinique">Clinique</button>
        <button class="filter-btn" data-type="mecanisme">Mécanisme</button>
        <button class="filter-btn" data-type="structure">Structure</button>
      </div>

      <div class="filters" id="tag-filters"></div>

      <div id="revision-list" class="fiches-list"></div>
    </div>
  `

  let fiches = [...allFiches]
  let activeType = ''
  let activeTags = []

  function applyFilter() {
    const filtered = fiches.filter((f) => {
      const matchesType = !activeType || f.type === activeType
      const matchesTags = activeTags.length === 0 || activeTags.some((t) => (f.tags || []).includes(t))
      return matchesType && matchesTags
    })
    renderList(filtered)
  }

  function renderList(list) {
    document.getElementById('revision-count').textContent = `${list.length} fiche${list.length !== 1 ? 's' : ''} à revoir`
    const listEl = document.getElementById('revision-list')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Rien à revoir pour l'instant.</p>`
      return
    }

    listEl.innerHTML = list
      .map(
        (f) => `
        <div class="fiche-row type-${f.type}" data-id="${f.id}">
          <div class="tab"></div>
          <div class="fiche-body" data-open="${f.id}">
            <div class="fiche-top">
              <span class="fiche-title voice">${f.titre}</span>
              <span class="type-label">${TYPE_LABELS[f.type]}</span>
            </div>
            <div class="fiche-meta">${f.matiere}${f.tags.length ? ' · ' + f.tags.join(', ') : ''}</div>
          </div>
          <div class="fiche-actions">
            <button class="btn primary" data-maitrise="${f.id}" style="width: auto;">Maîtrisé</button>
          </div>
        </div>
      `
      )
      .join('')

    listEl.querySelectorAll('[data-open]').forEach((el) => {
      el.addEventListener('click', () => {
        window.location.hash = `#fiche/${el.dataset.open}`
      })
    })

    listEl.querySelectorAll('[data-maitrise]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const id = btn.dataset.maitrise
        btn.disabled = true
        btn.textContent = '…'
        try {
          await updateStatut(id, 'valide')
          fiches = fiches.filter((f) => f.id !== id)
          applyFilter()
        } catch (err) {
          btn.textContent = 'Erreur'
        }
      })
    })
  }

  document.getElementById('type-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn')
    if (!btn) return
    document.querySelectorAll('#type-filters .filter-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    activeType = btn.dataset.type
    applyFilter()
  })

  await renderTagFilters(document.getElementById('tag-filters'), {
    selected: activeTags,
    onChange: (tags) => {
      activeTags = tags
      applyFilter()
    },
  })

  applyFilter()
}
