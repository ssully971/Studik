import promptMatieres from '../data/prompts/prompt-matieres.md?raw'
import promptClinique from '../data/prompts/prompt-fiche-clinique.md?raw'
import promptMecanisme from '../data/prompts/prompt-fiche-mecanisme.md?raw'
import promptStructure from '../data/prompts/prompt-fiche-structure.md?raw'
import promptCas from '../data/prompts/prompt-cas.md?raw'
import readme from '../data/prompts/README-prompts.md?raw'

const PROMPTS = [
  { id: 'matieres', titre: 'Matières', contenu: promptMatieres },
  { id: 'fiche-clinique', titre: 'Fiche — Clinique', contenu: promptClinique },
  { id: 'fiche-mecanisme', titre: 'Fiche — Mécanisme', contenu: promptMecanisme },
  { id: 'fiche-structure', titre: 'Fiche — Structure', contenu: promptStructure },
  { id: 'cas', titre: "Cas d'entraînement", contenu: promptCas },
]

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function renderPrompts(container) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Prompts d'import</h2>
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
    <div class="fiche-row" style="grid-template-columns: 4px 1fr auto;">
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
}