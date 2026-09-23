import { getAllQcm, updateQcmStatut, deleteQcm, updateQcmTags, insertQcm, getAllQcmIds } from '../lib/qcm.js'
import { demanderConfirmation } from '../lib/confirmer.js'
import { getMatieres, buildMatiereColorMap, couleurTab, getTousLesCoursAplatis } from '../lib/matieres.js'
import { getTags } from '../lib/tags.js'
import { getProgressions, supprimerProgression } from '../lib/qcm-progression.js'
import { renderTagPicker } from './tag-picker.js'
import { renderTagFilters } from './tag-filter.js'
import { slugify } from '../lib/slug.js'
import { escapeHtml } from '../lib/escape.js'

export async function renderQcmListe(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let allQcm
  try {
    allQcm = await getAllQcm({})
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">QCM</h2>
        <span class="count" id="qcm-count"></span>
      </div>

      <div class="import-actions" style="margin-bottom: 20px;">
        <button id="nouveau-qcm-btn" class="btn primary" style="width: auto;">+ Nouveau QCM</button>
        <div id="reprendre-zone"></div>
      </div>

      <input type="text" id="search-input" class="search-input" placeholder="Rechercher un QCM par titre…" />

      <div class="filters" id="qcm-filters">
        <select id="matiere-filter" class="periode-select"></select>
        <select id="cours-filter" class="periode-select"></select>
        <select id="statut-filter" class="periode-select">
          <option value="">Tous statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="valide">Validé</option>
          <option value="archive">Archivé</option>
        </select>
        <select id="tri-select" class="periode-select">
          <option value="recent">Plus récent</option>
          <option value="ancien">Plus ancien</option>
          <option value="alpha-asc">Alphabétique A→Z</option>
          <option value="alpha-desc">Alphabétique Z→A</option>
        </select>
      </div>

      <div class="filters" id="qcm-tag-filters"></div>

      <div id="qcm-list" class="fiches-list"></div>
    </div>

    <div id="nouveau-qcm-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span class="voice">Nouveau QCM</span>
          <button id="nouveau-qcm-close" class="btn" style="width: auto;">Fermer</button>
        </div>
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
    </div>

    <div id="reprises-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span class="voice">QCM en cours</span>
          <button id="reprises-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <div id="reprises-list"></div>
      </div>
    </div>
  `

  let tousLesTags = []
  try {
    tousLesTags = await getTags()
  } catch {
    tousLesTags = []
  }

  let matiereColorMap = {}

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
    matiereColorMap = buildMatiereColorMap(toutesMatieres)
    document.getElementById('nouveau-matieres').innerHTML = toutesMatieres.map((m) => `<option value="${escapeHtml(m.nom)}">${escapeHtml(m.nom)}</option>`).join('')
  } catch {
    // silencieux
  }

  const nouveauOverlay = document.getElementById('nouveau-qcm-overlay')
  document.getElementById('nouveau-qcm-btn').addEventListener('click', () => {
    nouveauOverlay.classList.remove('hidden')
  })
  document.getElementById('nouveau-qcm-close').addEventListener('click', () => {
    nouveauOverlay.classList.add('hidden')
  })
  nouveauOverlay.addEventListener('click', (e) => {
    if (e.target === nouveauOverlay) nouveauOverlay.classList.add('hidden')
  })

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

  // --- Reprise d'un QCM en cours ---
  const reprisesOverlay = document.getElementById('reprises-overlay')
  document.getElementById('reprises-close').addEventListener('click', () => {
    reprisesOverlay.classList.add('hidden')
  })
  reprisesOverlay.addEventListener('click', (e) => {
    if (e.target === reprisesOverlay) reprisesOverlay.classList.add('hidden')
  })

  async function chargerReprises() {
    const zone = document.getElementById('reprendre-zone')
    let progressions = []
    try {
      progressions = await getProgressions()
    } catch {
      progressions = []
    }

    if (progressions.length === 0) {
      zone.innerHTML = ''
      return
    }

    if (progressions.length === 1) {
      const p = progressions[0]
      const total = p.qcm?.questions?.length || 0
      zone.innerHTML = `
        <a href="#qcm-jouer/${p.qcm_id}" class="btn primary" style="width: auto;">Reprendre « ${p.qcm?.titre || p.qcm_id} » — question ${p.index_courant + 1}/${total}</a>
        <button id="abandonner-seul-btn" class="btn" style="width: auto; color: #C46A5C;">Abandonner ce QCM</button>
      `
      document.getElementById('abandonner-seul-btn').addEventListener('click', async () => {
        if (!(await demanderConfirmation('Abandonner ce QCM en cours ? Ta progression sera perdue, aucune tentative ne sera enregistrée.'))) return
        try {
          await supprimerProgression(p.qcm_id)
          chargerReprises()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
      return
    }

    zone.innerHTML = `<button id="ouvrir-reprises-btn" class="btn primary" style="width: auto;">Reprendre un QCM en cours (${progressions.length})</button>`
    document.getElementById('ouvrir-reprises-btn').addEventListener('click', () => {
      renderReprisesListe(progressions)
      reprisesOverlay.classList.remove('hidden')
    })
  }

  function renderReprisesListe(progressions) {
    const listEl = document.getElementById('reprises-list')
    listEl.innerHTML = progressions
      .map((p) => {
        const total = p.qcm?.questions?.length || 0
        return `
        <div class="fiche-row" data-progression="${p.qcm_id}">
          <div class="tab"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <span class="fiche-title voice">${p.qcm?.titre || p.qcm_id}</span>
              <span class="type-label">${p.mode}</span>
            </div>
            <div class="fiche-meta">Question ${p.index_courant + 1} / ${total}</div>
            <div class="import-actions" style="margin-top: 10px;">
              <a href="#qcm-jouer/${p.qcm_id}" class="btn primary" style="width: auto;">Reprendre</a>
              <button class="btn" data-abandonner="${p.qcm_id}" style="width: auto; color: #C46A5C;">Abandonner ce QCM</button>
            </div>
          </div>
        </div>
      `
      })
      .join('')

    listEl.querySelectorAll('[data-abandonner]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const qcmId = btn.dataset.abandonner
        if (!(await demanderConfirmation('Abandonner ce QCM en cours ? Ta progression sera perdue, aucune tentative ne sera enregistrée.'))) return
        try {
          await supprimerProgression(qcmId)
          const restantes = progressions.filter((p) => p.qcm_id !== qcmId)
          progressions = restantes
          if (restantes.length === 0) {
            document.getElementById('reprises-overlay').classList.add('hidden')
          } else {
            renderReprisesListe(restantes)
          }
          chargerReprises()
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })
  }

  chargerReprises()

  let activeMatiere = ''
  let activeCours = ''
  let activeStatut = ''
  let activeTags = []
  let activeTri = 'recent'

  function trier(list) {
    const copie = [...list]
    if (activeTri === 'recent') copie.sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation))
    else if (activeTri === 'ancien') copie.sort((a, b) => new Date(a.date_creation) - new Date(b.date_creation))
    else if (activeTri === 'alpha-asc') copie.sort((a, b) => a.titre.localeCompare(b.titre))
    else if (activeTri === 'alpha-desc') copie.sort((a, b) => b.titre.localeCompare(a.titre))
    return copie
  }

  function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase()
    const filtered = allQcm.filter((q) => {
      const matchesMatiere = !activeMatiere || (q.matieres || []).includes(activeMatiere)
      const matchesCours = !activeCours || q.cours === activeCours
      const matchesStatut = !activeStatut || q.statut === activeStatut
      const matchesSearch = !term || q.titre.toLowerCase().includes(term)
      const matchesTags = activeTags.length === 0 || activeTags.some((t) => (q.tags || []).includes(t))
      return matchesMatiere && matchesCours && matchesStatut && matchesSearch && matchesTags
    })
    document.getElementById('qcm-count').textContent = `${filtered.length} QCM`
    renderList(filtered)
  }

  function ligneQcm(q) {
    return `
      <div class="fiche-row" data-id="${q.id}">
        <div class="tab" style="background: ${couleurTab(q.matieres, null, matiereColorMap)};"></div>
        <div class="fiche-body">
          <div class="fiche-top">
            <a href="#qcm-detail/${q.id}" class="fiche-title voice">${escapeHtml(q.titre)}</a>
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
          <a href="#qcm-detail/${q.id}" class="btn" style="width: auto;">Détail</a>
          <a href="#qcm-jouer/${q.id}" class="btn primary" style="width: auto;">Lancer</a>
          <button class="btn" data-delete="${q.id}" style="width: auto; color: #C46A5C;">Supprimer</button>
        </div>
      </div>
    `
  }

  function lignesQcm(list) {
    return trier(list).map(ligneQcm).join('')
  }

  function grouperParMatiere(list) {
    const ordreParMatiere = {}
    toutesMatieres.forEach((m, i) => {
      ordreParMatiere[m.nom] = m.ordre_affichage ?? i
    })

    const groupes = {}
    list.forEach((q) => {
      const nom = (q.matieres && q.matieres[0]) || 'Sans matière'
      if (!groupes[nom]) groupes[nom] = []
      groupes[nom].push(q)
    })

    return Object.keys(groupes)
      .sort((a, b) => {
        const oa = ordreParMatiere[a]
        const ob = ordreParMatiere[b]
        if (oa === undefined && ob === undefined) return a.localeCompare(b)
        if (oa === undefined) return 1
        if (ob === undefined) return -1
        return oa - ob
      })
      .map((nom) => ({ nom, list: groupes[nom] }))
  }

  function renderList(list) {
    const listEl = document.getElementById('qcm-list')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun QCM ne correspond.</p>`
      return
    }

    if (activeMatiere) {
      listEl.innerHTML = lignesQcm(list)
    } else {
      listEl.innerHTML = grouperParMatiere(list)
        .map(
          ({ nom, list: listMatiere }) => `
        <div class="section-head" style="margin-top: 24px; padding-bottom: 8px;">
          <h3 class="voice" style="font-size: 16px;">${nom}</h3>
          <span class="count">${listMatiere.length}</span>
        </div>
        ${lignesQcm(listMatiere)}
      `
        )
        .join('')
    }

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
        if (!(await demanderConfirmation('Supprimer ce QCM ? Les tentatives associées resteront dans ton historique.'))) return
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

  document.getElementById('tri-select').addEventListener('change', (e) => {
    activeTri = e.target.value
    applyFilters()
  })

  const matiereSelect = document.getElementById('matiere-filter')
  matiereSelect.innerHTML =
    `<option value="">Toutes matières</option>` + toutesMatieres.map((m) => `<option value="${escapeHtml(m.nom)}">${escapeHtml(m.nom)}</option>`).join('')
  matiereSelect.addEventListener('change', (e) => {
    activeMatiere = e.target.value
    applyFilters()
  })

  try {
    const tousLesCours = await getTousLesCoursAplatis()
    const coursSelect = document.getElementById('cours-filter')
    coursSelect.innerHTML =
      `<option value="">Tous cours</option>` + tousLesCours.map((c) => `<option value="${escapeHtml(c.nom)}">${escapeHtml(c.chemin)}</option>`).join('')
    coursSelect.addEventListener('change', (e) => {
      activeCours = e.target.value
      applyFilters()
    })
  } catch {
    // silencieux : le filtre cours reste optionnel
  }

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
