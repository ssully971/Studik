import promptContexteMaitre from '../data/prompts/prompt-contexte-maitre.md?raw'
import promptMatieres from '../data/prompts/prompt-matieres.md?raw'
import promptClinique from '../data/prompts/prompt-fiche-clinique.md?raw'
import promptMecanisme from '../data/prompts/prompt-fiche-mecanisme.md?raw'
import promptStructure from '../data/prompts/prompt-fiche-structure.md?raw'
import promptCas from '../data/prompts/prompt-cas.md?raw'
import promptQcm from '../data/prompts/prompt-qcm.md?raw'
import readme from '../data/prompts/README-prompts.md?raw'
import { getTags, ajouterTag, supprimerTag } from '../lib/tags.js'

const PROMPTS = [
  { id: 'contexte-maitre', titre: 'Contexte maître (à coller avant les autres)', contenu: promptContexteMaitre },
  { id: 'matieres', titre: 'Matières', contenu: promptMatieres },
  { id: 'fiche-clinique', titre: 'Fiche — Clinique', contenu: promptClinique },
  { id: 'fiche-mecanisme', titre: 'Fiche — Mécanisme', contenu: promptMecanisme },
  { id: 'fiche-structure', titre: 'Fiche — Structure', contenu: promptStructure },
  { id: 'cas', titre: "Cas d'entraînement", contenu: promptCas },
  { id: 'qcm', titre: 'QCM', contenu: promptQcm },
]

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export async function renderPrompts(container) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Prompts d'import</h2>
      </div>

      <div class="settings-card" style="margin-bottom: 24px;">
        <h3 class="voice">Tags de référence</h3>
        <p class="settings-desc">Ta liste fermée de tags, à copier dans le champ "Tags autorisés" des prompts.</p>
        <div id="tags-chips" class="tags" style="margin-bottom: 12px;"></div>
        <div class="import-actions">
          <input type="text" id="nouveau-tag-input" class="search-input" placeholder="Nouveau tag…" style="max-width: 200px; margin-bottom: 0;" />
          <button id="ajouter-tag-btn" class="btn" style="width: auto;">Ajouter</button>
          <button id="copier-tags-btn" class="btn primary" style="width: auto;">Copier la liste</button>
          <span id="tags-status" class="import-status"></span>
        </div>
      </div>

      <div class="settings-card" style="margin-bottom: 24px;">
        <h3 class="voice">Comment ça marche</h3>
        <pre class="prompt-readme">${escapeHtml(readme)}</pre>
      </div>

      <div class="fiches-list" id="prompts-list"></div>
    </div>

    <div id="prompt-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="modal-title" class="voice"></span>
          <button id="modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <pre id="modal-content" class="prompt-readme"></pre>
      </div>
    </div>
  `

  const list = document.getElementById('prompts-list')
  list.innerHTML = PROMPTS.map(
    (p) => `
    <div class="fiche-row">
      <div class="tab"></div>
      <div class="fiche-body">
        <div class="fiche-top"><span class="fiche-title voice">${p.titre}</span></div>
      </div>
      <div class="fiche-actions" style="gap: 8px;">
        <button class="btn" data-view="${p.id}" style="width: auto;">Voir</button>
        <button class="btn primary" data-copy="${p.id}" style="width: auto;">Copier</button>
      </div>
    </div>
  `
  ).join('')

  const overlay = document.getElementById('prompt-modal-overlay')
  const modalTitle = document.getElementById('modal-title')
  const modalContent = document.getElementById('modal-content')

  list.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = PROMPTS.find((p) => p.id === btn.dataset.view)
      modalTitle.textContent = p.titre
      modalContent.textContent = p.contenu
      overlay.classList.remove('hidden')
    })
  })

  list.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = PROMPTS.find((p) => p.id === btn.dataset.copy)
      try {
        await navigator.clipboard.writeText(p.contenu)
        const original = btn.textContent
        btn.textContent = 'Copié !'
        setTimeout(() => {
          btn.textContent = original
        }, 1500)
      } catch (err) {
        alert('Impossible de copier : ' + err.message)
      }
    })
  })

  document.getElementById('modal-close').addEventListener('click', () => overlay.classList.add('hidden'))
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden')
  })

  // --- Tags de référence ---
  let tags = []
  try {
    tags = await getTags()
  } catch (err) {
    document.getElementById('tags-chips').innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
  }

  function renderTags() {
    const chipsEl = document.getElementById('tags-chips')
    chipsEl.innerHTML = tags.length
      ? tags.map((t) => `<span class="tag" data-tag="${t}" style="cursor: pointer;">${t} ×</span>`).join('')
      : `<p class="empty-note" style="padding: 0;">Aucun tag pour l'instant.</p>`

    chipsEl.querySelectorAll('[data-tag]').forEach((chip) => {
      chip.addEventListener('click', async () => {
        const nom = chip.dataset.tag
        try {
          await supprimerTag(nom)
          tags = tags.filter((t) => t !== nom)
          renderTags()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }

  renderTags()

  document.getElementById('ajouter-tag-btn').addEventListener('click', async () => {
    const input = document.getElementById('nouveau-tag-input')
    const statusEl = document.getElementById('tags-status')
    const nom = input.value.trim()

    if (!nom) return
    if (tags.includes(nom)) {
      statusEl.textContent = 'Ce tag existe déjà.'
      statusEl.className = 'import-status error'
      return
    }

    try {
      await ajouterTag(nom)
      tags.push(nom)
      tags.sort()
      renderTags()
      input.value = ''
      statusEl.textContent = ''
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.getElementById('copier-tags-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('tags-status')
    try {
      await navigator.clipboard.writeText(tags.join(', '))
      statusEl.textContent = 'Copié !'
      statusEl.className = 'import-status success'
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })
}
