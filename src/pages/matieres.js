import { getMatieres, updateMatiere, deleteMatiere, insertMatieres, getAllMatiereIds } from '../lib/matieres.js'
import { getFicheCountByMatiere } from '../lib/fiches.js'
import { slugify } from '../lib/slug.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

export async function renderMatieres(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let matieres
  try {
    matieres = await getMatieres()
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Gestion des matières</h2>
        <span class="count">${matieres.length} matière${matieres.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="settings-card" style="margin-bottom: 24px;">
        <h3 class="voice">Nouvelle matière</h3>
        <p class="settings-desc">Pour un import en lot, passe plutôt par #import.</p>
        <div class="matiere-edit-grid">
          <label>
            Nom
            <input type="text" id="nouvelle-nom" placeholder="Sémiologie cardio" />
          </label>
          <label>
            Type
            <select id="nouvelle-type" class="periode-select">
              <option value="clinique">Clinique</option>
              <option value="mecanisme">Mécanisme</option>
              <option value="structure">Structure</option>
            </select>
          </label>
          <label>
            Couleur
            <input type="text" id="nouvelle-couleur" placeholder="#4EA189" />
          </label>
          <label>
            Ordre
            <input type="number" id="nouvelle-ordre" value="0" />
          </label>
          <label>
            Année
            <input type="text" id="nouvelle-annee" placeholder="P2" />
          </label>
          <label>
            Semestre
            <input type="text" id="nouvelle-semestre" placeholder="S1" />
          </label>
        </div>
        <div class="import-actions">
          <button id="creer-matiere-btn" class="btn primary" style="width: auto;">Créer la matière</button>
          <span id="creation-status" class="import-status"></span>
        </div>
      </div>

      <div id="matieres-list" class="fiches-list"></div>
    </div>
  `

  document.getElementById('creer-matiere-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('creation-status')
    const nom = document.getElementById('nouvelle-nom').value.trim()
    const type = document.getElementById('nouvelle-type').value
    const couleur = document.getElementById('nouvelle-couleur').value.trim() || null
    const ordre_affichage = parseInt(document.getElementById('nouvelle-ordre').value, 10) || 0
    const annee = document.getElementById('nouvelle-annee').value.trim() || null
    const semestre = document.getElementById('nouvelle-semestre').value.trim() || null

    if (!nom) {
      statusEl.textContent = 'Le nom est obligatoire.'
      statusEl.className = 'import-status error'
      return
    }

    const id = slugify(nom)

    try {
      const idsExistants = await getAllMatiereIds()
      if (idsExistants.includes(id)) {
        statusEl.textContent = `Une matière avec l'id "${id}" existe déjà.`
        statusEl.className = 'import-status error'
        return
      }
      await insertMatieres([{ id, nom, type, couleur, ordre_affichage, annee, semestre }])
      renderMatieres(container)
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  const listEl = document.getElementById('matieres-list')

  if (matieres.length === 0) {
    listEl.innerHTML = `<p class="empty-note">Aucune matière pour l'instant.</p>`
    return
  }

  listEl.innerHTML = matieres
    .map(
      (m) => `
      <div class="fiche-row type-${m.type}" style="grid-template-columns: 4px 1fr;">
        <div class="tab"></div>
        <div class="fiche-body">
          <div class="fiche-top">
            <span class="fiche-title voice">${m.nom}</span>
            <span class="type-label">${TYPE_LABELS[m.type]}</span>
          </div>

          <div class="matiere-edit-grid">
            <label>
              Couleur
              <input type="text" data-field="couleur" data-id="${m.id}" value="${m.couleur || ''}" placeholder="#4EA189" />
            </label>
            <label>
              Ordre
              <input type="number" data-field="ordre_affichage" data-id="${m.id}" value="${m.ordre_affichage ?? 0}" />
            </label>
            <label>
              Année
              <input type="text" data-field="annee" data-id="${m.id}" value="${m.annee || ''}" placeholder="P2" />
            </label>
            <label>
              Semestre
              <input type="text" data-field="semestre" data-id="${m.id}" value="${m.semestre || ''}" placeholder="S1" />
            </label>
          </div>

          <div class="import-actions">
            <button class="btn" data-save="${m.id}" style="width: auto;">Enregistrer</button>
            <button class="btn" data-delete="${m.id}" data-nom="${m.nom}" style="width: auto; color: #C46A5C;">Supprimer</button>
            <span class="import-status" id="status-${m.id}"></span>
          </div>
        </div>
      </div>
    `
    )
    .join('')

  listEl.querySelectorAll('[data-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.save
      const statusEl = document.getElementById(`status-${id}`)
      const champs = {}
      listEl.querySelectorAll(`[data-id="${id}"]`).forEach((input) => {
        const field = input.dataset.field
        let value = input.value.trim()
        if (field === 'ordre_affichage') value = value ? parseInt(value, 10) : 0
        if ((field === 'couleur' || field === 'annee' || field === 'semestre') && value === '') value = null
        champs[field] = value
      })

      try {
        await updateMatiere(id, champs)
        statusEl.textContent = 'Enregistré.'
        statusEl.className = 'import-status success'
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message
        statusEl.className = 'import-status error'
      }
    })
  })

  listEl.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delete
      const nom = btn.dataset.nom
      const statusEl = document.getElementById(`status-${id}`)

      let nbFiches
      try {
        nbFiches = await getFicheCountByMatiere(nom)
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message
        statusEl.className = 'import-status error'
        return
      }

      const message =
        nbFiches > 0
          ? `${nbFiches} fiche${nbFiches !== 1 ? 's' : ''} ${nbFiches !== 1 ? 'sont' : 'est'} encore rattachée${nbFiches !== 1 ? 's' : ''} à "${nom}". Supprimer quand même la matière (les fiches resteront, mais sans matière valide) ?`
          : `Supprimer la matière "${nom}" ? Cette action est définitive.`

      if (!window.confirm(message)) return

      try {
        await deleteMatiere(id)
        renderMatieres(container)
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message
        statusEl.className = 'import-status error'
      }
    })
  })
}
