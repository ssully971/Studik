import { getTags } from '../lib/tags.js'

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

  container.innerHTML = tags
    .map((t) => `<button class="filter-btn ${actifs.includes(t) ? 'active' : ''}" data-tag="${t}">${t}</button>`)
    .join('')

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tag]')
    if (!btn) return
    const tag = btn.dataset.tag
    if (actifs.includes(tag)) {
      actifs = actifs.filter((t) => t !== tag)
      btn.classList.remove('active')
    } else {
      actifs.push(tag)
      btn.classList.add('active')
    }
    onChange(actifs)
  })
}
