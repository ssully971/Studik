import { escapeHtml } from '../../lib/escape.js'

// Chips de qualification d'erreur (§7.4) — sélection multiple par tap. Réutilise la classe
// .filter-btn existante plutôt que d'inventer un nouveau style.
export function renderTagsErreurChips(tags, selectionnes = []) {
  return `
    <div class="filters" id="tags-erreur-chips">
      ${tags
        .map(
          (t) => `<button type="button" class="filter-btn ${selectionnes.includes(t) ? 'active' : ''}" data-tag-erreur="${escapeHtml(t)}">${escapeHtml(t)}</button>`
        )
        .join('')}
    </div>
  `
}

export function attacherTagsErreurChips(container, onChange) {
  const el = container.querySelector('#tags-erreur-chips')
  if (!el) return
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tag-erreur]')
    if (!btn) return
    btn.classList.toggle('active')
    onChange(Array.from(el.querySelectorAll('.active')).map((b) => b.dataset.tagErreur))
  })
}
