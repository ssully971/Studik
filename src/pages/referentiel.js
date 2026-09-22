import { getFiches, texteRechercheFiche } from '../lib/fiches.js'
import { getMatieres, buildMatiereColorMap, getCouleurEffective, getArbreMatieres, estCoursNoeud, getTousLesCoursAplatis } from '../lib/matieres.js'
import { getPeriodeActuelle, resoudrePeriodesEffectives } from '../lib/periode.js'
import { getTagsAvecPerimetre } from '../lib/tags.js'
import { exporterFichesPDF } from '../lib/pdf.js'
import { renderTagFilters } from './tag-filter.js'
import { escapeHtml } from '../lib/escape.js'

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
      </div>

      <div class="filters" id="tri-filters">
        <select id="matiere-filter" class="periode-select"></select>
        <select id="sous-matiere-filter" class="periode-select"></select>
        <select id="cours-filter" class="periode-select"></select>
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
      </div>

      <div class="filters" id="tag-filters"></div>

      <div class="import-actions" style="margin-bottom: 18px;">
        <button id="export-pdf-btn" class="btn" style="width: auto;">Exporter en PDF</button>
        <button id="export-json-btn" class="btn" style="width: auto;">Exporter en JSON</button>
      </div>

      <div id="fiches-list" class="fiches-list"></div>
    </div>
  `

  let allFiches = []
  let currentFiltered = []
  let activeType = ''
  let activeMatiere = ''
  let activeSousMatiere = ''
  let activeCours = ''
  let activeTags = []
  let activeTri = 'recent'
  let inclureArchivees = false
  let matiereColorMap = {}
  let matieresTop = []
  let perimetreParTag = {}

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
      const matchesSousMatiere = !activeSousMatiere || f.sous_matiere === activeSousMatiere
      const matchesCours = !activeCours || f.cours === activeCours
      const matchesSearch = !searchTerm || texteRechercheFiche(f).includes(searchTerm)
      const matchesTags = activeTags.length === 0 || activeTags.some((t) => (f.tags || []).includes(t))
      return matchesType && matchesMatiere && matchesSousMatiere && matchesCours && matchesSearch && matchesTags
    })
    currentFiltered = filtered
    document.getElementById('fiche-count').textContent = `${filtered.length} fiche${filtered.length !== 1 ? 's' : ''}`
    renderList(filtered)
  }

  function ligneFiche(f) {
    return `
      <div class="fiche-row type-${f.type}" data-id="${f.id}">
        <div class="tab" style="background: ${getCouleurEffective(f.matiere, f.sous_matiere, matiereColorMap, f.type)};"></div>
        <div class="fiche-body">
          <div class="fiche-top">
            <span class="fiche-title voice">${escapeHtml(f.titre)}</span>
            ${f.dernier_resultat === 'pas_bien' ? '<span class="pas-top-dot" title="Marquée pas top à la dernière révision"></span>' : ''}
            <span class="type-label">${TYPE_LABELS[f.type]}</span>
          </div>
          <div class="fiche-meta">${escapeHtml(f.matiere)}${f.sous_matiere ? ' · ' + escapeHtml(f.sous_matiere) : ''}${f.tags.length ? ' · ' + escapeHtml(f.tags.join(', ')) : ''}</div>
        </div>
      </div>
    `
  }

  function lignesFiches(fiches) {
    return trier(fiches).map(ligneFiche).join('')
  }

  function grouperParMatiere(fiches) {
    const ordreParMatiere = {}
    matieresTop.forEach((m, i) => {
      ordreParMatiere[m.nom] = m.ordre_affichage ?? i
    })

    const groupes = {}
    fiches.forEach((f) => {
      if (!groupes[f.matiere]) groupes[f.matiere] = []
      groupes[f.matiere].push(f)
    })

    return Object.keys(groupes)
      .sort((a, b) => {
        const oa = ordreParMatiere[a]
        const ob = ordreParMatiere[b]
        if (oa === undefined && ob === undefined) return a.localeCompare(b)
        if (oa === undefined) return 1
        if (ob === undefined) return -1
        return oa - ob
      })
      .map((nom) => ({ nom, fiches: groupes[nom] }))
  }

  function scinderParSousMatiere(fiches) {
    const sansSousMatiere = fiches.filter((f) => !f.sous_matiere)
    const parSousMatiere = {}
    fiches.forEach((f) => {
      if (!f.sous_matiere) return
      if (!parSousMatiere[f.sous_matiere]) parSousMatiere[f.sous_matiere] = []
      parSousMatiere[f.sous_matiere].push(f)
    })
    const sousGroupes = Object.keys(parSousMatiere)
      .sort((a, b) => a.localeCompare(b))
      .map((nom) => ({ nom, fiches: parSousMatiere[nom] }))
    return { sansSousMatiere, sousGroupes }
  }

  function renderList(fiches) {
    const list = document.getElementById('fiches-list')

    if (fiches.length === 0) {
      list.innerHTML = `<p class="empty-note">Aucune fiche ne correspond.</p>`
      return
    }

    if (activeMatiere) {
      list.innerHTML = lignesFiches(fiches)
    } else {
      list.innerHTML = grouperParMatiere(fiches)
        .map(({ nom, fiches: fichesMatiere }) => {
          const { sansSousMatiere, sousGroupes } = scinderParSousMatiere(fichesMatiere)
          return `
            <div class="section-head" style="margin-top: 24px; padding-bottom: 8px;">
              <h3 class="voice" style="font-size: 16px;">${escapeHtml(nom)}</h3>
              <span class="count">${fichesMatiere.length}</span>
            </div>
            ${lignesFiches(sansSousMatiere)}
            ${sousGroupes
              .map(
                (sg) => `
              <div class="section-head" style="margin-top: 10px; border-bottom: none; padding-bottom: 0; padding-left: 14px;">
                <h4 class="voice" style="font-size: 13px; color: var(--text-dim);">${escapeHtml(sg.nom)}</h4>
              </div>
              ${lignesFiches(sg.fiches)}
            `
              )
              .join('')}
          `
        })
        .join('')
    }

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
    exporterFichesPDF(trier(currentFiltered), nom)
  })

  document.getElementById('export-json-btn').addEventListener('click', () => {
    if (currentFiltered.length === 0) return
    const nom = activeMatiere ? `studik-${activeMatiere}` : 'studik-referentiel'
    const blob = new Blob([JSON.stringify(trier(currentFiltered), null, 2)], { type: 'application/json' })
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
    matieresTop = await getMatieres({})
    matiereColorMap = buildMatiereColorMap(matieresTop)
    const matiereSelect = document.getElementById('matiere-filter')
    matiereSelect.innerHTML =
      `<option value="">Toutes matières</option>` + matieresTop.map((m) => `<option value="${escapeHtml(m.nom)}">${escapeHtml(m.nom)}</option>`).join('')
    matiereSelect.addEventListener('change', (e) => {
      activeMatiere = e.target.value
      applyFilters()
    })
  } catch {
    // silencieux : le filtre matière reste optionnel
  }

  try {
    const arbreComplet = await getArbreMatieres({})
    const sousMatieres = new Set()
    function collecterSousMatieres(noeud, profondeur) {
      if (estCoursNoeud(noeud, profondeur)) return
      if (profondeur === 1) sousMatieres.add(noeud.nom)
      ;(noeud.enfants || []).forEach((e) => collecterSousMatieres(e, profondeur + 1))
    }
    arbreComplet.forEach((r) => collecterSousMatieres(r, 0))

    const sousMatiereSelect = document.getElementById('sous-matiere-filter')
    sousMatiereSelect.innerHTML =
      `<option value="">Toutes sous-matières</option>` +
      Array.from(sousMatieres)
        .sort((a, b) => a.localeCompare(b))
        .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
        .join('')
    sousMatiereSelect.addEventListener('change', (e) => {
      activeSousMatiere = e.target.value
      applyFilters()
    })

    const tousLesCours = await getTousLesCoursAplatis()
    const coursSelect = document.getElementById('cours-filter')
    coursSelect.innerHTML =
      `<option value="">Tous cours</option>` + tousLesCours.map((c) => `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.chemin)}</option>`).join('')
    coursSelect.addEventListener('change', (e) => {
      activeCours = e.target.value
      applyFilters()
    })
  } catch {
    // silencieux : les filtres sous-matière/cours restent optionnels
  }

  try {
    const tagsAvecPerimetre = await getTagsAvecPerimetre()
    tagsAvecPerimetre.forEach((t) => {
      perimetreParTag[t.nom] = t.perimetre
    })
  } catch {
    perimetreParTag = {}
  }

  await renderTagFilters(document.getElementById('tag-filters'), {
    selected: activeTags,
    onChange: (tags) => {
      activeTags = tags
      chargerFiches()
    },
  })

  async function chargerFiches() {
    try {
      const periodeNavbar = getPeriodeActuelle()
      const periodes = resoudrePeriodesEffectives(periodeNavbar, activeTags, perimetreParTag)
      allFiches = periodes.length > 0 ? await getFiches({ periodes, inclureArchivees }) : await getFiches({ inclureArchivees })
      applyFilters()
    } catch (err) {
      document.getElementById('fiches-list').innerHTML = `<p class="empty-note">Erreur de chargement : ${err.message}</p>`
    }
  }

  await chargerFiches()
}
