import promptContexteMaitre from '../data/prompts/prompt-contexte-maitre.md?raw'
import promptMatieres from '../data/prompts/prompt-matieres.md?raw'
import promptClinique from '../data/prompts/prompt-fiche-clinique.md?raw'
import promptMecanisme from '../data/prompts/prompt-fiche-mecanisme.md?raw'
import promptStructure from '../data/prompts/prompt-fiche-structure.md?raw'
import promptCas from '../data/prompts/prompt-cas.md?raw'
import promptQcm from '../data/prompts/prompt-qcm.md?raw'
import readme from '../data/prompts/README-prompts.md?raw'
import { getTags, getTagsAvecPerimetre, ajouterTag, supprimerTag, modifierPerimetreTag } from '../lib/tags.js'
import { getPeriodesDisponibles } from '../lib/periode.js'

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
        <p class="settings-desc">Ta liste fermée de tags, à copier dans le champ "Tags autorisés" des prompts. Clique un tag pour lui associer une ou plusieurs périodes (📍 = tag scopé) ; laisse-le sans période pour qu'il s'applique partout.</p>
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

    <div id="perimetre-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span id="perimetre-modal-title" class="voice"></span>
          <button id="perimetre-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <p class="settings-desc">Ne coche rien pour que ce tag s'applique à toutes les périodes.</p>
        <div id="perimetre-checkboxes"></div>
        <div class="import-actions">
          <button id="perimetre-save-btn" class="btn primary" style="width: auto;">Enregistrer</button>
          <span id="perimetre-status" class="import-status"></span>
        </div>
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
    tags = await getTagsAvecPerimetre()
  } catch {
    // La colonne "perimetre" n'existe peut-être pas encore (migration pas encore appliquée) :
    // on retombe sur la liste simple pour que la gestion de base des tags reste utilisable.
    try {
      tags = (await getTags()).map((nom) => ({ nom, perimetre: null }))
    } catch (err) {
      document.getElementById('tags-chips').innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
    }
  }

  let periodesDisponibles = []
  try {
    periodesDisponibles = await getPeriodesDisponibles()
  } catch {
    periodesDisponibles = []
  }

  function labelPeriode(p) {
    return p.semestre ? `${p.annee} · ${p.semestre}` : p.annee
  }

  function renderTags() {
    const chipsEl = document.getElementById('tags-chips')
    chipsEl.innerHTML = tags.length
      ? tags
          .map(
            (t) => `
        <span class="tag" data-edit="${t.nom}" style="cursor: pointer;">
          ${t.nom}${t.perimetre && t.perimetre.length ? ' 📍' : ''}
          <button class="tag-remove-btn" data-remove="${t.nom}" title="Supprimer ce tag">×</button>
        </span>
      `
          )
          .join('')
      : `<p class="empty-note" style="padding: 0;">Aucun tag pour l'instant.</p>`

    chipsEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const nom = btn.dataset.remove
        try {
          await supprimerTag(nom)
          tags = tags.filter((t) => t.nom !== nom)
          renderTags()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    chipsEl.querySelectorAll('[data-edit]').forEach((chip) => {
      chip.addEventListener('click', () => ouvrirEditeurPerimetre(chip.dataset.edit))
    })
  }

  renderTags()

  const perimetreOverlay = document.getElementById('perimetre-modal-overlay')
  document.getElementById('perimetre-modal-close').addEventListener('click', () => perimetreOverlay.classList.add('hidden'))
  perimetreOverlay.addEventListener('click', (e) => {
    if (e.target === perimetreOverlay) perimetreOverlay.classList.add('hidden')
  })

  function ouvrirEditeurPerimetre(nom) {
    const tag = tags.find((t) => t.nom === nom)
    if (!tag) return

    document.getElementById('perimetre-modal-title').textContent = `Périodes — ${nom}`
    document.getElementById('perimetre-status').textContent = ''

    const checkboxesEl = document.getElementById('perimetre-checkboxes')
    if (periodesDisponibles.length === 0) {
      checkboxesEl.innerHTML = `<p class="empty-note" style="padding: 0;">Aucune période disponible pour l'instant (renseigne l'année d'une matière pour en créer).</p>`
    } else {
      const perimetreActuel = tag.perimetre || []
      checkboxesEl.innerHTML = periodesDisponibles
        .map((p, i) => {
          const coche = perimetreActuel.some((sp) => sp.annee === p.annee && (sp.semestre || null) === (p.semestre || null))
          return `
          <label class="tag-dropdown-item" style="cursor: pointer;">
            <input type="checkbox" data-periode-index="${i}" ${coche ? 'checked' : ''} />
            <span>${labelPeriode(p)}</span>
          </label>
        `
        })
        .join('')
    }

    perimetreOverlay.classList.remove('hidden')

    document.getElementById('perimetre-save-btn').onclick = async () => {
      const statusEl = document.getElementById('perimetre-status')
      const cochees = Array.from(checkboxesEl.querySelectorAll('[data-periode-index]:checked')).map(
        (cb) => periodesDisponibles[parseInt(cb.dataset.periodeIndex, 10)]
      )
      const perimetre = cochees.length > 0 ? cochees.map((p) => ({ annee: p.annee, semestre: p.semestre || null })) : null

      try {
        await modifierPerimetreTag(nom, perimetre)
        tag.perimetre = perimetre
        renderTags()
        statusEl.textContent = 'Enregistré.'
        statusEl.className = 'import-status success'
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message
        statusEl.className = 'import-status error'
      }
    }
  }

  document.getElementById('ajouter-tag-btn').addEventListener('click', async () => {
    const input = document.getElementById('nouveau-tag-input')
    const statusEl = document.getElementById('tags-status')
    const nom = input.value.trim()

    if (!nom) return
    if (tags.some((t) => t.nom === nom)) {
      statusEl.textContent = 'Ce tag existe déjà.'
      statusEl.className = 'import-status error'
      return
    }

    try {
      await ajouterTag(nom)
      tags.push({ nom, perimetre: null })
      tags.sort((a, b) => a.nom.localeCompare(b.nom))
      renderTags()
      input.value = ''
      statusEl.textContent = ''
      ouvrirEditeurPerimetre(nom)
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.getElementById('copier-tags-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('tags-status')
    try {
      await navigator.clipboard.writeText(tags.map((t) => t.nom).join(', '))
      statusEl.textContent = 'Copié !'
      statusEl.className = 'import-status success'
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })
}
