import { getTags } from '../lib/tags.js'

export async function renderTagPicker(container, { selected = [], onChange, tousLesTags } = {}) {
  let disponibles = tousLesTags
  if (!disponibles) {
    try {
      disponibles = await getTags()
    } catch {
      disponibles = []
    }
  }

  let choisis = [...selected]

  function optionsRestantes() {
    return disponibles.filter((t) => !choisis.includes(t))
  }

  function render() {
    container.innerHTML = `
      <div class="tags" style="margin: 0 0 8px;">
        ${
          choisis.length
            ? choisis.map((t) => `<span class="tag" data-remove="${t}" style="cursor: pointer;">${t} ×</span>`).join('')
            : `<p class="empty-note" style="padding: 0;">Aucun tag.</p>`
        }
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <select class="periode-select" id="tag-picker-select">
          <option value="">+ Ajouter un tag…</option>
          ${optionsRestantes()
            .map((t) => `<option value="${t}">${t}</option>`)
            .join('')}
        </select>
        <a href="#import/prompts" class="btn" style="width: auto;">Nouveau tag</a>
      </div>
    `

    container.querySelectorAll('[data-remove]').forEach((chip) => {
      chip.addEventListener('click', () => {
        choisis = choisis.filter((t) => t !== chip.dataset.remove)
        render()
        onChange(choisis)
      })
    })

    const select = container.querySelector('#tag-picker-select')
    select.addEventListener('change', () => {
      if (select.value && !choisis.includes(select.value)) {
        choisis.push(select.value)
        render()
        onChange(choisis)
      }
    })
  }

  render()
}
