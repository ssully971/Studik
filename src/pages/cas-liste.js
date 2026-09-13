import { getAllCas, deleteCas, updateCasStatut, updateCasTags } from '../lib/cas.js'
import { getMatieres } from '../lib/matieres.js'
import { getTags } from '../lib/tags.js'
import { renderTagPicker } from './tag-picker.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

export async function renderCasListe(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let allCas
  try {
    allCas = await getAllCas()
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Bibliothèque de cas</h2>
        <span class="count" id="cas-count"></span>
      </div>

      <input type="text" id="search-input" class="search-input" placeholder="Rechercher dans les questions…" />

      <div class="filters" id="cas-filters">
        <button class="filter-btn active" data-type="">Tous types</button>
        <button class="filter-btn" data-type="clinique">Clinique</button>
        <button class="filter-btn" data-type="mecanisme">Mécanisme</button>
        <button class="filter-btn" data-type="structure">Structure</button>
        <select id="matiere-filter" class="periode-select"></select>
        <select id="niveau-filter" class="periode-select">
          <option value="">Tous niveaux</option>
          <option value="1">Niveau 1</option>
          <option value="2">Niveau 2</option>
          <option value="3">Niveau 3</option>
        </select>
      </div>

      <div id="cas-list" class="fiches-list"></div>
    </div>
  `

  let tousLesTags = []
  try {
    tousLesTags = await getTags()
  } catch {
    tousLesTags = []
  }

  let activeType = ''
  let activeMatiere = ''
  let activeNiveau = ''

  function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase()
    const filtered = allCas.filter((c) => {
      const matchesType = !activeType || c.type === activeType
      const matchesMatiere = !activeMatiere || c.matiere === activeMatiere
      const matchesNiveau = !activeNiveau || String(c.niveau) === activeNiveau
      const matchesSearch = !term || c.question.toLowerCase().includes(term)
      return matchesType && matchesMatiere && matchesNiveau && matchesSearch
    })
    renderList(filtered)
  }

  function renderList(list) {
    document.getElementById('cas-count').textContent = `${list.length} cas`
    const listEl = document.getElementById('cas-list')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun cas ne correspond.</p>`
      return
    }

    listEl.innerHTML = list
      .map(
        (c) => `
        <div class="fiche-row type-${c.type}" data-id="${c.id}">
          <div class="tab"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${c.question}</span>
              <span class="type-label">${TYPE_LABELS[c.type]} · niveau ${c.niveau}</span>
            </div>
            <div class="fiche-meta">${c.matiere}</div>
            <div style="margin-top: 8px;" id="tags-picker-${c.id}"></div>
          </div>
          <div class="fiche-actions" style="gap: 8px;">
            <select class="periode-select" data-statut="${c.id}">
              <option value="brouillon" ${c.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
              <option value="valide" ${c.statut === 'valide' ? 'selected' : ''}>Validé</option>
              <option value="archive" ${c.statut === 'archive' ? 'selected' : ''}>Archivé</option>
            </select>
            <a href="#entrainement/${c.id}" class="btn primary" style="width: auto;">Lancer</a>
            <button class="btn" data-delete="${c.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
          </div>
        </div>
      `
      )
      .join('')

    listEl.querySelectorAll('[data-statut]').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const id = select.dataset.statut
        try {
          await updateCasStatut(id, e.target.value)
          const cas = allCas.find((c) => c.id === id)
          if (cas) cas.statut = e.target.value
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delete
        if (!window.confirm('Supprimer ce cas clinique ? Les tentatives associées resteront dans ton historique.')) return
        try {
          await deleteCas(id)
          allCas = allCas.filter((c) => c.id !== id)
          applyFilters()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    list.forEach((c) => {
      const pickerEl = document.getElementById(`tags-picker-${c.id}`)
      if (!pickerEl) return
      renderTagPicker(pickerEl, {
        selected: c.tags || [],
        tousLesTags,
        onChange: async (nouveauxTags) => {
          try {
            await updateCasTags(c.id, nouveauxTags)
            c.tags = nouveauxTags
          } catch (err) {
            alert('Erreur : ' + err.message)
          }
        },
      })
    })
  }

  document.getElementById('search-input').addEventListener('input', applyFilters)

  document.getElementById('cas-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn')
    if (!btn) return
    document.querySelectorAll('#cas-filters .filter-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    activeType = btn.dataset.type
    applyFilters()
  })

  document.getElementById('niveau-filter').addEventListener('change', (e) => {
    activeNiveau = e.target.value
    applyFilters()
  })

  try {
    const matieres = await getMatieres({})
    const matiereSelect = document.getElementById('matiere-filter')
    matiereSelect.innerHTML =
      `<option value="">Toutes matières</option>` + matieres.map((m) => `<option value="${m.nom}">${m.nom}</option>`).join('')
    matiereSelect.addEventListener('change', (e) => {
      activeMatiere = e.target.value
      applyFilters()
    })
  } catch {
    // silencieux
  }

  applyFilters()
}
