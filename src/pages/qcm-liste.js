import { getAllQcm, updateQcmStatut, deleteQcm, updateQcmTags, insertQcm, getAllQcmIds } from '../lib/qcm.js'
import { getMatieres } from '../lib/matieres.js'
import { getTags } from '../lib/tags.js'
import { renderTagPicker } from './tag-picker.js'
import { renderTagFilters } from './tag-filter.js'
import { slugify } from '../lib/slug.js'

export async function renderQcmListe(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let allQcm
  try {
    allQcm = await getAllQcm({})
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">QCM</h2>
        <span class="count" id="qcm-count"></span>
      </div>

      <div class="settings-card" style="margin-bottom: 24px;">
        <h3 class="voice">Nouveau QCM</h3>
        <p class="settings-desc">Crée la fiche d'identité du QCM ici, puis ajoute les questions via #import (JSON généré par le prompt QCM).</p>
        <div style="margin-bottom: 14px;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Titre</label>
          <input type="text" id="nouveau-titre" class="search-input" style="margin-bottom: 0;" placeholder="Douleur thoracique" />
        </div>
        <div style="margin-bottom: 14px;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Matières (plusieurs possibles)</label>
          <select id="nouveau-matieres" class="periode-select" multiple size="4" style="width: 100%;"></select>
        </div>
        <div style="margin-bottom: 14px;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Durée en mode concours (minutes)</label>
          <input type="number" id="nouveau-duree" class="search-input" style="margin-bottom: 0; max-width: 120px;" value="30" />
        </div>
        <div style="margin-bottom: 14px;">
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Tags</label>
          <div id="nouveau-tags-picker"></div>
        </div>
        <div class="import-actions">
          <button id="creer-qcm-btn" class="btn primary" style="width: auto;">Créer le QCM</button>
          <span id="creation-status" class="import-status"></span>
        </div>
      </div>

      <input type="text" id="search-input" class="search-input" placeholder="Rechercher un QCM par titre…" />

      <div class="filters" id="qcm-filters">
        <select id="matiere-filter" class="periode-select"></select>
        <select id="statut-filter" class="periode-select">
          <option value="">Tous statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="valide">Validé</option>
          <option value="archive">Archivé</option>
        </select>
      </div>

      <div class="filters" id="qcm-tag-filters"></div>

      <div id="qcm-list" class="fiches-list"></div>
    </div>
  `

  let tousLesTags = []
  try {
    tousLesTags = await getTags()
  } catch {
    tousLesTags = []
  }

  let tagsNouveauQcm = []
  renderTagPicker(document.getElementById('nouveau-tags-picker'), {
    selected: tagsNouveauQcm,
    tousLesTags,
    onChange: (nouveauxTags) => {
      tagsNouveauQcm = nouveauxTags
    },
  })

  let toutesMatieres = []
  try {
    toutesMatieres = await getMatieres({})
    document.getElementById('nouveau-matieres').innerHTML = toutesMatieres.map((m) => `<option value="${m.nom}">${m.nom}</option>`).join('')
  } catch {
    // silencieux
  }

  document.getElementById('creer-qcm-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('creation-status')
    const titre = document.getElementById('nouveau-titre').value.trim()
    const matieresSelectionnees = Array.from(document.getElementById('nouveau-matieres').selectedOptions).map((o) => o.value)
    const duree_minutes = parseInt(document.getElementById('nouveau-duree').value, 10) || 30

    if (!titre) {
      statusEl.textContent = 'Le titre est obligatoire.'
      statusEl.className = 'import-status error'
      return
    }

    const id = `qcm_${slugify(titre)}`

    try {
      const idsExistants = await getAllQcmIds()
      if (idsExistants.includes(id)) {
        statusEl.textContent = `Un QCM avec l'id "${id}" existe déjà.`
        statusEl.className = 'import-status error'
        return
      }
      await insertQcm([
        {
          id,
          titre,
          matieres: matieresSelectionnees,
          duree_minutes,
          tags: tagsNouveauQcm,
          questions: [],
        },
      ])
      renderQcmListe(container)
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  let activeMatiere = ''
  let activeStatut = ''
  let activeTags = []

  function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase()
    const filtered = allQcm.filter((q) => {
      const matchesMatiere = !activeMatiere || (q.matieres || []).includes(activeMatiere)
      const matchesStatut = !activeStatut || q.statut === activeStatut
      const matchesSearch = !term || q.titre.toLowerCase().includes(term)
      const matchesTags = activeTags.length === 0 || activeTags.some((t) => (q.tags || []).includes(t))
      return matchesMatiere && matchesStatut && matchesSearch && matchesTags
    })
    renderList(filtered)
  }

  function renderList(list) {
    document.getElementById('qcm-count').textContent = `${list.length} QCM`
    const listEl = document.getElementById('qcm-list')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun QCM ne correspond.</p>`
      return
    }

    listEl.innerHTML = list
      .map(
        (q) => `
        <div class="fiche-row" data-id="${q.id}">
          <div class="tab"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${q.titre}</span>
              <span class="type-label">${q.questions.length} question${q.questions.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="fiche-meta">${(q.matieres || []).join(', ') || 'Aucune matière'} · ${q.duree_minutes} min en concours</div>
            <div style="margin-top: 8px;" id="tags-picker-${q.id}"></div>
          </div>
          <div class="fiche-actions" style="gap: 8px;">
            <select class="periode-select" data-statut="${q.id}">
              <option value="brouillon" ${q.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
              <option value="valide" ${q.statut === 'valide' ? 'selected' : ''}>Validé</option>
              <option value="archive" ${q.statut === 'archive' ? 'selected' : ''}>Archivé</option>
            </select>
            <a href="#qcm-jouer/${q.id}" class="btn primary" style="width: auto;">Lancer</a>
            <button class="btn" data-delete="${q.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
          </div>
        </div>
      `
      )
      .join('')

    listEl.querySelectorAll('[data-statut]').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const id = select.dataset.statut
        try {
          await updateQcmStatut(id, e.target.value)
          const qcm = allQcm.find((q) => q.id === id)
          if (qcm) qcm.statut = e.target.value
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delete
        if (!window.confirm('Supprimer ce QCM ? Les tentatives associées resteront dans ton historique.')) return
        try {
          await deleteQcm(id)
          allQcm = allQcm.filter((q) => q.id !== id)
          applyFilters()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    list.forEach((q) => {
      const pickerEl = document.getElementById(`tags-picker-${q.id}`)
      if (!pickerEl) return
      renderTagPicker(pickerEl, {
        selected: q.tags || [],
        tousLesTags,
        onChange: async (nouveauxTags) => {
          try {
            await updateQcmTags(q.id, nouveauxTags)
            q.tags = nouveauxTags
          } catch (err) {
            alert('Erreur : ' + err.message)
          }
        },
      })
    })
  }

  document.getElementById('search-input').addEventListener('input', applyFilters)

  document.getElementById('statut-filter').addEventListener('change', (e) => {
    activeStatut = e.target.value
    applyFilters()
  })

  const matiereSelect = document.getElementById('matiere-filter')
  matiereSelect.innerHTML =
    `<option value="">Toutes matières</option>` + toutesMatieres.map((m) => `<option value="${m.nom}">${m.nom}</option>`).join('')
  matiereSelect.addEventListener('change', (e) => {
    activeMatiere = e.target.value
    applyFilters()
  })

  await renderTagFilters(document.getElementById('qcm-tag-filters'), {
    selected: activeTags,
    tousLesTags,
    onChange: (tags) => {
      activeTags = tags
      applyFilters()
    },
  })

  applyFilters()
}
