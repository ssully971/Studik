import { getAllCas, deleteCas, updateCasStatut, updateCasTags, updateCas, GABARITS_CAS } from '../lib/cas.js'
import { getMatieres } from '../lib/matieres.js'
import { getTags } from '../lib/tags.js'
import { renderTagPicker } from './tag-picker.js'
import { renderTagFilters } from './tag-filter.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

function itemsVersTexte(items) {
  return (items || []).map((item) => `[${item.correct ? 'x' : ' '}] ${item.label}`).join('\n')
}

function texteVersItems(texte) {
  return texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean)
    .map((ligne) => {
      const match = ligne.match(/^\[(x|X| )\]\s*(.*)$/)
      if (match) return { label: match[2], correct: match[1].toLowerCase() === 'x' }
      return { label: ligne, correct: false }
    })
}

function renderFormulaireEdition(c) {
  const gabarit = GABARITS_CAS[c.type] || GABARITS_CAS.clinique
  const items = (c.reponse_attendue && c.reponse_attendue[gabarit.itemsKey]) || []
  const resultats = (c.reponse_attendue && c.reponse_attendue[gabarit.resultKey]) || []

  return `
    <h3 class="voice">Modifier ce cas</h3>
    <div class="matiere-edit-grid" style="grid-template-columns: 1fr 140px 140px;">
      <label>
        Matière
        <input type="text" data-champ="matiere" value="${c.matiere}" />
      </label>
      <label>
        Type
        <select data-champ="type">
          <option value="clinique" ${c.type === 'clinique' ? 'selected' : ''}>Clinique</option>
          <option value="mecanisme" ${c.type === 'mecanisme' ? 'selected' : ''}>Mécanisme</option>
          <option value="structure" ${c.type === 'structure' ? 'selected' : ''}>Structure</option>
        </select>
      </label>
      <label>
        Niveau
        <select data-champ="niveau">
          <option value="1" ${c.niveau === 1 ? 'selected' : ''}>1</option>
          <option value="2" ${c.niveau === 2 ? 'selected' : ''}>2</option>
          <option value="3" ${c.niveau === 3 ? 'selected' : ''}>3</option>
        </select>
      </label>
    </div>

    <div style="margin-bottom: 14px;">
      <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Question</label>
      <input type="text" data-champ="question" class="search-input" style="margin-bottom: 0;" value="${c.question}" />
    </div>

    <div style="margin-bottom: 14px;">
      <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Situation</label>
      <textarea data-champ="situation" class="notes-textarea">${(c.enonce && c.enonce.situation) || ''}</textarea>
    </div>

    <div style="margin-bottom: 14px;">
      <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Éléments de l'énoncé (une ligne = un élément)</label>
      <textarea data-champ="elements" class="notes-textarea">${((c.enonce && c.enonce.elements) || []).join('\n')}</textarea>
    </div>

    <div style="margin-bottom: 14px;">
      <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">
        ${gabarit.itemsLabel} (une ligne = un élément, [x] si correct, [ ] sinon)
      </label>
      <textarea data-champ="items" class="notes-textarea" style="min-height: 130px;">${itemsVersTexte(items)}</textarea>
    </div>

    <div style="margin-bottom: 14px;">
      <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">${gabarit.resultLabel} (une ligne = un élément)</label>
      <textarea data-champ="resultats" class="notes-textarea">${resultats.join('\n')}</textarea>
    </div>

    <div class="import-actions">
      <button class="btn primary" data-sauvegarder="${c.id}" style="width: auto;">Enregistrer</button>
      <span class="import-status" id="edit-status-${c.id}"></span>
    </div>
  `
}

export async function renderCasListe(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let allCas
  try {
    allCas = await getAllCas()
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Bibliothèque de cas</h2>
        <span class="count" id="cas-count"></span>
      </div>

      <input type="text" id="search-input" class="search-input" placeholder="Rechercher dans les questions…" />

      <div class="filters" id="cas-filters">
        <button class="filter-btn active" data-type="">Tous types</button>
        <button class="filter-btn" data-type="clinique">Clinique</button>
        <button class="filter-btn" data-type="mecanisme">Mécanisme</button>
        <button class="filter-btn" data-type="structure">Structure</button>
        <select id="matiere-filter" class="periode-select"></select>
        <select id="niveau-filter" class="periode-select">
          <option value="">Tous niveaux</option>
          <option value="1">Niveau 1</option>
          <option value="2">Niveau 2</option>
          <option value="3">Niveau 3</option>
        </select>
      </div>

      <div class="filters" id="tag-filters"></div>

      <div id="cas-list" class="fiches-list"></div>
    </div>
  `

  let tousLesTags = []
  try {
    tousLesTags = await getTags()
  } catch {
    tousLesTags = []
  }

  let activeType = ''
  let activeMatiere = ''
  let activeNiveau = ''
  let activeTags = []

  function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase()
    const filtered = allCas.filter((c) => {
      const matchesType = !activeType || c.type === activeType
      const matchesMatiere = !activeMatiere || c.matiere === activeMatiere
      const matchesNiveau = !activeNiveau || String(c.niveau) === activeNiveau
      const matchesSearch = !term || c.question.toLowerCase().includes(term)
      const matchesTags = activeTags.length === 0 || activeTags.some((t) => (c.tags || []).includes(t))
      return matchesType && matchesMatiere && matchesNiveau && matchesSearch && matchesTags
    })
    renderList(filtered)
  }

  function renderList(list) {
    document.getElementById('cas-count').textContent = `${list.length} cas`
    const listEl = document.getElementById('cas-list')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun cas ne correspond.</p>`
      return
    }

    listEl.innerHTML = list
      .map(
        (c) => `
        <div class="fiche-row type-${c.type}" data-id="${c.id}">
          <div class="tab"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${c.question}</span>
              <span class="type-label">${TYPE_LABELS[c.type]} · niveau ${c.niveau}</span>
            </div>
            <div class="fiche-meta">${c.matiere}</div>
            <div style="margin-top: 8px;" id="tags-picker-${c.id}"></div>
          </div>
          <div class="fiche-actions" style="gap: 8px;">
            <select class="periode-select" data-statut="${c.id}">
              <option value="brouillon" ${c.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
              <option value="valide" ${c.statut === 'valide' ? 'selected' : ''}>Validé</option>
              <option value="archive" ${c.statut === 'archive' ? 'selected' : ''}>Archivé</option>
            </select>
            <a href="#entrainement/${c.id}" class="btn primary" style="width: auto;">Lancer</a>
            <button class="btn" data-modifier="${c.id}" style="width: auto;">Modifier</button>
            <button class="btn" data-delete="${c.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
          </div>
        </div>
        <div class="settings-card cas-edit-panel hidden" id="edit-panel-${c.id}" style="margin: -6px 0 14px;">
          ${renderFormulaireEdition(c)}
        </div>
      `
      )
      .join('')

    listEl.querySelectorAll('[data-statut]').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const id = select.dataset.statut
        try {
          await updateCasStatut(id, e.target.value)
          const cas = allCas.find((c) => c.id === id)
          if (cas) cas.statut = e.target.value
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delete
        if (!window.confirm('Supprimer ce cas clinique ? Les tentatives associées seront supprimées aussi.')) return
        try {
          await deleteCas(id)
          allCas = allCas.filter((c) => c.id !== id)
          applyFilters()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    listEl.querySelectorAll('[data-modifier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById(`edit-panel-${btn.dataset.modifier}`).classList.toggle('hidden')
      })
    })

    listEl.querySelectorAll('[data-sauvegarder]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.sauvegarder
        const cas = allCas.find((c) => c.id === id)
        if (!cas) return

        const panel = document.getElementById(`edit-panel-${id}`)
        const statusEl = document.getElementById(`edit-status-${id}`)
        const champ = (nom) => panel.querySelector(`[data-champ="${nom}"]`).value

        const gabarit = GABARITS_CAS[champ('type')] || GABARITS_CAS.clinique
        const champs = {
          matiere: champ('matiere').trim(),
          type: champ('type'),
          niveau: parseInt(champ('niveau'), 10),
          question: champ('question').trim(),
          enonce: {
            situation: champ('situation').trim(),
            elements: champ('elements')
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
          },
          reponse_attendue: {
            [gabarit.itemsKey]: texteVersItems(champ('items')),
            [gabarit.resultKey]: champ('resultats')
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
          },
        }

        try {
          await updateCas(id, champs)
          Object.assign(cas, champs)
          statusEl.textContent = 'Enregistré.'
          statusEl.className = 'import-status success'
          applyFilters()
        } catch (err) {
          statusEl.textContent = 'Erreur : ' + err.message
          statusEl.className = 'import-status error'
        }
      })
    })

    list.forEach((c) => {
      const pickerEl = document.getElementById(`tags-picker-${c.id}`)
      if (!pickerEl) return
      renderTagPicker(pickerEl, {
        selected: c.tags || [],
        tousLesTags,
        onChange: async (nouveauxTags) => {
          try {
            await updateCasTags(c.id, nouveauxTags)
            c.tags = nouveauxTags
          } catch (err) {
            alert('Erreur : ' + err.message)
          }
        },
      })
    })
  }

  document.getElementById('search-input').addEventListener('input', applyFilters)

  document.getElementById('cas-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn')
    if (!btn) return
    document.querySelectorAll('#cas-filters .filter-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    activeType = btn.dataset.type
    applyFilters()
  })

  document.getElementById('niveau-filter').addEventListener('change', (e) => {
    activeNiveau = e.target.value
    applyFilters()
  })

  try {
    const matieres = await getMatieres({})
    const matiereSelect = document.getElementById('matiere-filter')
    matiereSelect.innerHTML =
      `<option value="">Toutes matières</option>` + matieres.map((m) => `<option value="${m.nom}">${m.nom}</option>`).join('')
    matiereSelect.addEventListener('change', (e) => {
      activeMatiere = e.target.value
      applyFilters()
    })
  } catch {
    // silencieux
  }

  await renderTagFilters(document.getElementById('tag-filters'), {
    selected: activeTags,
    tousLesTags,
    onChange: (tags) => {
      activeTags = tags
      applyFilters()
    },
  })

  applyFilters()
}
