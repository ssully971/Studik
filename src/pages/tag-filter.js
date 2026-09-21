import { getTags } from '../lib/tags.js'

// Menu déroulant compact et recherchable pour filtrer par tag(s) — composant partagé par
// toutes les pages qui filtrent par tag (référentiel, entraînement, QCM, révision, erreurs).
export async function renderTagFilters(container, { selected = [], onChange, tousLesTags } = {}) {
  let tags = tousLesTags
  if (!tags) {
    try {
      tags = await getTags()
    } catch {
      tags = []
    }
  }

  if (tags.length === 0) {
    container.innerHTML = ''
    return
  }

  let actifs = [...selected]
  let recherche = ''
  let ouvert = false

  function libelleBouton() {
    return actifs.length === 0 ? 'Tags ▾' : `${actifs.length} tag${actifs.length !== 1 ? 's' : ''} ▾`
  }

  function render() {
    const terme = recherche.toLowerCase()
    const tagsFiltres = tags.filter((t) => t.toLowerCase().includes(terme))

    container.innerHTML = `
      <div class="tag-dropdown">
        <button type="button" class="filter-btn tag-dropdown-btn ${actifs.length ? 'active' : ''}">${libelleBouton()}</button>
        <div class="tag-dropdown-panel ${ouvert ? '' : 'hidden'}">
          <input type="text" class="tag-dropdown-search" placeholder="Rechercher un tag…" value="${recherche}" />
          <div class="tag-dropdown-list">
            ${
              tagsFiltres.length
                ? tagsFiltres
                    .map(
                      (t) => `
              <label class="tag-dropdown-item">
                <input type="checkbox" data-tag="${t}" ${actifs.includes(t) ? 'checked' : ''} />
                <span>${t}</span>
              </label>
            `
                    )
                    .join('')
                : `<p class="tag-dropdown-empty">Aucun tag ne correspond.</p>`
            }
          </div>
        </div>
      </div>
    `

    const dropdown = container.querySelector('.tag-dropdown')
    dropdown.addEventListener('click', (e) => e.stopPropagation())

    container.querySelector('.tag-dropdown-btn').addEventListener('click', () => {
      ouvert = !ouvert
      render()
      if (ouvert) container.querySelector('.tag-dropdown-search')?.focus()
    })

    const searchInput = container.querySelector('.tag-dropdown-search')
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        recherche = e.target.value
        render()
        const nouvelInput = container.querySelector('.tag-dropdown-search')
        nouvelInput.focus()
        const fin = nouvelInput.value.length
        nouvelInput.setSelectionRange(fin, fin)
      })
    }

    container.querySelectorAll('[data-tag]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const tag = cb.dataset.tag
        if (cb.checked) actifs.push(tag)
        else actifs = actifs.filter((x) => x !== tag)
        onChange(actifs)
        render()
      })
    })
  }

  render()

  document.addEventListener('click', () => {
    if (ouvert) {
      ouvert = false
      render()
    }
  })
}
