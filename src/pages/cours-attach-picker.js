import { getCoursAttaches, attacherContenu, detacherContenu } from '../lib/contenuCours.js'
import { getTousLesEmplacements } from '../lib/matieres.js'
import { escapeHtml } from '../lib/escape.js'

// Widget réutilisable (fiche-detail, qcm-detail, cas) : gère les rattachements secondaires
// d'un contenu à des cours supplémentaires (table contenu_cours), en plus de son
// rattachement principal (matiere/sous_matiere/cours sur la ligne elle-même) — permet de
// mettre un même élément dans plusieurs cours. La liste des cours est toujours rechargée
// depuis la base à l'ouverture, pour qu'un cours créé après coup soit immédiatement
// disponible ici.
export async function renderCoursAttachPicker(container, { type, id }) {
  container.innerHTML = `<p class="empty-note" style="padding: 4px 0;">Chargement…</p>`

  let tousLesCours, coursAttaches
  try {
    ;[tousLesCours, coursAttaches] = await Promise.all([getTousLesEmplacements(), getCoursAttaches(type, id)])
  } catch (err) {
    container.innerHTML = `<p class="empty-note" style="padding: 4px 0;">Impossible de charger les emplacements (${escapeHtml(err.message)}).</p>`
    return
  }

  function optionsGroupees(emplacements) {
    const groupes = [
      ['Matières', emplacements.filter((c) => c.niveau === 'matiere')],
      ['Sous-matières', emplacements.filter((c) => c.niveau === 'sous-matiere')],
      ['Cours', emplacements.filter((c) => c.niveau === 'cours')],
    ]
    return groupes
      .filter(([, liste]) => liste.length > 0)
      .map(([label, liste]) => `<optgroup label="${label}">${liste.map((c) => `<option value="${c.id}">${escapeHtml(c.chemin)}</option>`).join('')}</optgroup>`)
      .join('')
  }

  let filtreTerme = ''

  function render() {
    const attachesInfo = coursAttaches.map((cid) => tousLesCours.find((c) => c.id === cid)).filter(Boolean)
    const disponibles = tousLesCours
      .filter((c) => !coursAttaches.includes(c.id))
      .filter((c) => !filtreTerme || c.chemin.toLowerCase().includes(filtreTerme))
    container.innerHTML = `
      <div class="liens-list" style="margin-bottom: 8px;">
        ${
          attachesInfo.length
            ? attachesInfo
                .map((c) => `<div class="lien-item"><span>${escapeHtml(c.chemin)}</span><button type="button" class="lien-remove" data-detacher="${c.id}">×</button></div>`)
                .join('')
            : `<p class="empty-note" style="padding: 4px 0;">Aucun cours supplémentaire.</p>`
        }
      </div>
      <input type="text" class="search-input" data-recherche-emplacement value="${escapeHtml(filtreTerme)}" placeholder="Rechercher…" style="margin-bottom: 8px;" />
      <select id="cours-attach-select" class="periode-select" style="width: 100%;">
        <option value="">+ Attacher à une autre matière/sous-matière/cours…</option>
        ${optionsGroupees(disponibles)}
      </select>
      <span class="import-status" id="cours-attach-status"></span>
    `

    container.querySelectorAll('[data-detacher]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await detacherContenu(btn.dataset.detacher, type, id)
          coursAttaches = coursAttaches.filter((cid) => cid !== btn.dataset.detacher)
          render()
        } catch (err) {
          container.querySelector('#cours-attach-status').textContent = 'Erreur : ' + err.message
        }
      })
    })

    const rechercheInput = container.querySelector('[data-recherche-emplacement]')
    rechercheInput.addEventListener('input', (e) => {
      filtreTerme = e.target.value.trim().toLowerCase()
      render()
      container.querySelector('[data-recherche-emplacement]').focus()
      const val = container.querySelector('[data-recherche-emplacement]')
      val.selectionStart = val.selectionEnd = val.value.length
    })

    container.querySelector('#cours-attach-select').addEventListener('change', async (e) => {
      const coursId = e.target.value
      if (!coursId) return
      try {
        await attacherContenu(coursId, type, id)
        coursAttaches = [...coursAttaches, coursId]
        filtreTerme = ''
        render()
      } catch (err) {
        container.querySelector('#cours-attach-status').textContent = 'Erreur : ' + err.message
      }
    })
  }

  render()
}
