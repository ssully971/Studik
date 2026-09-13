import { getAllQcm, updateQcmStatut, deleteQcm } from '../lib/qcm.js'
import { getMatieres } from '../lib/matieres.js'

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

      <div id="qcm-list" class="fiches-list"></div>
    </div>
  `

  let activeMatiere = ''
  let activeStatut = ''

  function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase()
    const filtered = allQcm.filter((q) => {
      const matchesMatiere = !activeMatiere || (q.matieres || []).includes(activeMatiere)
      const matchesStatut = !activeStatut || q.statut === activeStatut
      const matchesSearch = !term || q.titre.toLowerCase().includes(term)
      return matchesMatiere && matchesStatut && matchesSearch
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
  }

  document.getElementById('search-input').addEventListener('input', applyFilters)

  document.getElementById('statut-filter').addEventListener('change', (e) => {
    activeStatut = e.target.value
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

  applyFilters()
}
