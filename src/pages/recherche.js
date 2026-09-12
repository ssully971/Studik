import { getFiches } from '../lib/fiches.js'
import { getMatieres } from '../lib/matieres.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

export async function renderRecherche(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let allFiches, matieres
  try {
    ;[allFiches, matieres] = await Promise.all([getFiches({}), getMatieres({})])
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  const periodeParMatiere = {}
  matieres.forEach((m) => {
    periodeParMatiere[m.nom] = m.semestre ? `${m.annee} · ${m.semestre}` : m.annee || ''
  })

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Recherche globale</h2>
        <span class="count" id="recherche-count"></span>
      </div>

      <p class="import-hint">Cherche dans toutes tes fiches, toutes années et matières confondues — indépendamment de la période sélectionnée en haut.</p>

      <input type="text" id="search-input" class="search-input" placeholder="Signe, structure, mécanisme, matière, mot-clé…" autofocus />

      <div id="recherche-list" class="fiches-list"></div>
    </div>
  `

  const input = document.getElementById('search-input')

  function renderList(fiches) {
    document.getElementById('recherche-count').textContent = `${fiches.length} résultat${fiches.length !== 1 ? 's' : ''}`
    const listEl = document.getElementById('recherche-list')

    if (fiches.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun résultat.</p>`
      return
    }

    listEl.innerHTML = fiches
      .map((f) => {
        const periode = periodeParMatiere[f.matiere]
        return `
        <div class="fiche-row type-${f.type}" data-id="${f.id}">
          <div class="tab"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${f.titre}</span>
              <span class="type-label">${TYPE_LABELS[f.type]}</span>
            </div>
            <div class="fiche-meta">${f.matiere}${periode ? ' · ' + periode : ''}${f.tags.length ? ' · ' + f.tags.join(', ') : ''}</div>
          </div>
        </div>
      `
      })
      .join('')

    listEl.querySelectorAll('.fiche-row').forEach((row) => {
      row.addEventListener('click', () => {
        window.location.hash = `#fiche/${row.dataset.id}`
      })
    })
  }

  function applyFilter() {
    const term = input.value.trim().toLowerCase()
    if (!term) {
      renderList([])
      return
    }
    const filtered = allFiches.filter((f) => {
      return (
        f.titre.toLowerCase().includes(term) ||
        f.matiere.toLowerCase().includes(term) ||
        f.tags.some((t) => t.toLowerCase().includes(term)) ||
        (f.synonymes || []).some((s) => s.toLowerCase().includes(term))
      )
    })
    renderList(filtered)
  }

  input.addEventListener('input', applyFilter)
  renderList([])
}
