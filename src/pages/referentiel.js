import { getFiches, texteRechercheFiche } from '../lib/fiches.js'
import { getMatieres, buildMatiereColorMap, couleurTab } from '../lib/matieres.js'
import { getPeriodeActuelle } from '../lib/periode.js'
import { exporterFichesPDF } from '../lib/pdf.js'
import { renderTagFilters } from './tag-filter.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

export async function renderReferentiel(container) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Référentiel</h2>
        <span class="count" id="fiche-count"></span>
      </div>

      <input type="text" id="search-input" class="search-input" placeholder="Rechercher un signe, une structure, un mécanisme…" />

      <div class="filters" id="type-filters">
        <button class="filter-btn active" data-type="">Tous</button>
        <button class="filter-btn" data-type="clinique">Clinique</button>
        <button class="filter-btn" data-type="mecanisme">Mécanisme</button>
        <button class="filter-btn" data-type="structure">Structure</button>
        <select id="matiere-filter" class="periode-select"></select>
        <select id="tri-select" class="periode-select">
          <option value="recent">Plus récent</option>
          <option value="ancien">Plus ancien</option>
          <option value="alpha-asc">Alphabétique A→Z</option>
          <option value="alpha-desc">Alphabétique Z→A</option>
        </select>
        <label class="checkbox-label" style="width: auto; margin-left: 8px;">
          <input type="checkbox" id="archivees-checkbox" />
          <span>Afficher les fiches archivées</span>
        </label>
        <button id="export-pdf-btn" class="btn" style="width: auto; margin-left: auto;">Exporter en PDF</button>
        <button id="export-json-btn" class="btn" style="width: auto;">Exporter en JSON</button>
      </div>

      <div class="filters" id="tag-filters"></div>

      <div id="fiches-list" class="fiches-list"></div>
    </div>
  `

  let allFiches = []
  let currentFiltered = []
  let activeType = ''
  let activeMatiere = ''
  let activeTags = []
  let activeTri = 'recent'
  let inclureArchivees = false
  let matiereColorMap = {}

  function trier(list) {
    const copie = [...list]
    if (activeTri === 'recent') copie.sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation))
    else if (activeTri === 'ancien') copie.sort((a, b) => new Date(a.date_creation) - new Date(b.date_creation))
    else if (activeTri === 'alpha-asc') copie.sort((a, b) => a.titre.localeCompare(b.titre))
    else if (activeTri === 'alpha-desc') copie.sort((a, b) => b.titre.localeCompare(a.titre))
    return copie
  }

  function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase()
    const filtered = allFiches.filter((f) => {
      const matchesType = !activeType || f.type === activeType
      const matchesMatiere = !activeMatiere || f.matiere === activeMatiere
      const matchesSearch = !searchTerm || texteRechercheFiche(f).includes(searchTerm)
      const matchesTags = activeTags.length === 0 || activeTags.some((t) => (f.tags || []).includes(t))
      return matchesType && matchesMatiere && matchesSearch && matchesTags
    })
    currentFiltered = trier(filtered)
    renderList(currentFiltered)
  }

  function renderList(fiches) {
    document.getElementById('fiche-count').textContent = `${fiches.length} fiche${fiches.length !== 1 ? 's' : ''}`
    const list = document.getElementById('fiches-list')

    if (fiches.length === 0) {
      list.innerHTML = `<p class="empty-note">Aucune fiche ne correspond.</p>`
      return
    }

    list.innerHTML = fiches
      .map(
        (f) => `
        <div class="fiche-row type-${f.type}" data-id="${f.id}">
          <div class="tab" style="background: ${couleurTab(f.matiere, f.type, matiereColorMap)};"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${f.titre}</span>
              ${f.dernier_resultat === 'pas_bien' ? '<span class="pas-top-dot" title="Marquée pas top à la dernière révision"></span>' : ''}
              <span class="type-label">${TYPE_LABELS[f.type]}</span>
            </div>
            <div class="fiche-meta">${f.matiere}${f.tags.length ? ' · ' + f.tags.join(', ') : ''}</div>
          </div>
        </div>
      `
      )
      .join('')

    list.querySelectorAll('.fiche-row').forEach((row) => {
      row.addEventListener('click', () => {
        window.location.hash = `#fiche/${row.dataset.id}`
      })
    })
  }

  document.getElementById('search-input').addEventListener('input', applyFilters)

  document.getElementById('type-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn')
    if (!btn) return
    document.querySelectorAll('#type-filters .filter-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    activeType = btn.dataset.type
    applyFilters()
  })

  document.getElementById('export-pdf-btn').addEventListener('click', () => {
    if (currentFiltered.length === 0) return
    const nom = activeMatiere ? `studik-${activeMatiere}` : 'studik-referentiel'
    exporterFichesPDF(currentFiltered, nom)
  })

  document.getElementById('export-json-btn').addEventListener('click', () => {
    if (currentFiltered.length === 0) return
    const nom = activeMatiere ? `studik-${activeMatiere}` : 'studik-referentiel'
    const blob = new Blob([JSON.stringify(currentFiltered, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nom}.json`
    a.click()
    URL.revokeObjectURL(url)
  })

  document.getElementById('tri-select').addEventListener('change', (e) => {
    activeTri = e.target.value
    applyFilters()
  })

  document.getElementById('archivees-checkbox').addEventListener('change', async (e) => {
    inclureArchivees = e.target.checked
    await chargerFiches()
  })

  try {
    const matieres = await getMatieres({})
    matiereColorMap = buildMatiereColorMap(matieres)
    const matiereSelect = document.getElementById('matiere-filter')
    matiereSelect.innerHTML =
      `<option value="">Toutes matières</option>` + matieres.map((m) => `<option value="${m.nom}">${m.nom}</option>`).join('')
    matiereSelect.addEventListener('change', (e) => {
      activeMatiere = e.target.value
      applyFilters()
    })
  } catch {
    // silencieux : le filtre matière reste optionnel
  }

  await renderTagFilters(document.getElementById('tag-filters'), {
    selected: activeTags,
    onChange: (tags) => {
      activeTags = tags
      applyFilters()
    },
  })

  async function chargerFiches() {
    try {
      const periode = getPeriodeActuelle()
      const params = periode ? { annee: periode.annee, semestre: periode.semestre } : {}
      allFiches = await getFiches({ ...params, inclureArchivees })
      applyFilters()
    } catch (err) {
      document.getElementById('fiches-list').innerHTML = `<p class="empty-note">Erreur de chargement : ${err.message}</p>`
    }
  }

  await chargerFiches()
}
