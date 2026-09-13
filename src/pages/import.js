import { insertFiches, getAllFicheIds } from '../lib/fiches.js'
import { insertCas, getAllCasIds } from '../lib/cas.js'
import { insertMatieres, getAllMatiereIds, getAllMatiereNoms } from '../lib/matieres.js'
import { insertQcm, getAllQcmIds } from '../lib/qcm.js'

function findDuplicateIds(items) {
  const seen = new Set()
  const duplicates = new Set()
  items.forEach((item) => {
    if (seen.has(item.id)) duplicates.add(item.id)
    seen.add(item.id)
  })
  return Array.from(duplicates)
}

const REQUIRED_FIELDS = {
  fiches: ['id', 'matiere', 'type', 'titre'],
  cas: ['id', 'matiere', 'type', 'niveau', 'question'],
  matieres: ['id', 'nom', 'type'],
  qcm: ['id', 'titre', 'questions'],
}

const TARGET_LABELS = {
  fiches: { singulier: 'fiche', pluriel: 'fiches', ajoutees: 'ajoutées' },
  cas: { singulier: 'cas', pluriel: 'cas', ajoutees: 'ajoutés' },
  matieres: { singulier: 'matière', pluriel: 'matières', ajoutees: 'ajoutées' },
  qcm: { singulier: 'QCM', pluriel: 'QCM', ajoutees: 'ajoutés' },
}

export function renderImport(container) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Import de contenu</h2>
      </div>

      <div class="filters" id="target-filters">
        <button class="filter-btn active" data-target="fiches">Fiches</button>
        <button class="filter-btn" data-target="cas">Cas cliniques</button>
        <button class="filter-btn" data-target="qcm">QCM</button>
        <button class="filter-btn" data-target="matieres">Matières</button>
      </div>

      <p class="import-hint">
        Colle ici un tableau JSON (généré par Claude en chat). Le format attendu dépend du type sélectionné ci-dessus.
        Un id déjà existant met à jour l'élément plutôt que de le dupliquer.
      </p>

      <textarea id="json-input" class="json-textarea" placeholder='[{"id": "...", ...}]'></textarea>

      <div class="import-actions">
        <button id="import-btn" class="btn primary" style="width: auto;">Importer</button>
      </div>

      <div id="import-result"></div>
    </div>
  `

  let target = 'fiches'

  document.getElementById('target-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn')
    if (!btn) return
    document.querySelectorAll('#target-filters .filter-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    target = btn.dataset.target
    document.getElementById('import-result').innerHTML = ''
  })

  document.getElementById('import-btn').addEventListener('click', async () => {
    const resultEl = document.getElementById('import-result')
    resultEl.innerHTML = ''
    const raw = document.getElementById('json-input').value.trim()

    if (!raw) {
      resultEl.innerHTML = `<p class="import-status error">Colle du JSON avant d'importer.</p>`
      return
    }

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      resultEl.innerHTML = `<p class="import-status error">JSON invalide : ${err.message}</p>`
      return
    }

    const items = Array.isArray(parsed) ? parsed : [parsed]

    if (items.length === 0) {
      resultEl.innerHTML = `<p class="import-status error">Le tableau JSON est vide.</p>`
      return
    }

    const requiredFields = REQUIRED_FIELDS[target]
    const incompleteIndex = items.findIndex((item) =>
      requiredFields.some((f) => item[f] === undefined || item[f] === null || item[f] === '')
    )
    if (incompleteIndex !== -1) {
      resultEl.innerHTML = `<p class="import-status error">Élément n°${incompleteIndex + 1} incomplet — champs obligatoires : ${requiredFields.join(', ')}.</p>`
      return
    }

    if (target === 'qcm') {
      const sansQuestions = items.findIndex((q) => !Array.isArray(q.questions) || q.questions.length === 0)
      if (sansQuestions !== -1) {
        resultEl.innerHTML = `<p class="import-status error">QCM n°${sansQuestions + 1} : le tableau "questions" doit contenir au moins une question.</p>`
        return
      }
    }

    const doublons = findDuplicateIds(items)
    if (doublons.length > 0) {
      resultEl.innerHTML = `<p class="import-status error">Doublon(s) d'id dans ce lot : ${doublons.join(', ')}. Corrige avant de réimporter.</p>`
      return
    }

    let existingIds
    try {
      if (target === 'fiches') existingIds = await getAllFicheIds()
      else if (target === 'cas') existingIds = await getAllCasIds()
      else if (target === 'qcm') existingIds = await getAllQcmIds()
      else existingIds = await getAllMatiereIds()
    } catch (err) {
      resultEl.innerHTML = `<p class="import-status error">Erreur lors de la vérification des ids existants : ${err.message}</p>`
      return
    }

    const existingSet = new Set(existingIds)
    const nouveaux = items.filter((i) => !existingSet.has(i.id)).length
    const misesAJour = items.length - nouveaux

    const avertissements = []
    if (target === 'fiches') {
      const idsConnus = new Set([...existingIds, ...items.map((i) => i.id)])
      items.forEach((f) => {
        ;[...(f.pre_requis || []), ...(f.consequences || [])].forEach((refId) => {
          if (!idsConnus.has(refId)) {
            avertissements.push(`Lien vers "${refId}" non résolu (dans la fiche "${f.id}") — la fiche n'existe pas encore.`)
          }
        })
      })

      let matiereNoms
      try {
        matiereNoms = new Set(await getAllMatiereNoms())
      } catch {
        matiereNoms = new Set()
      }
      items.forEach((f) => {
        if (!matiereNoms.has(f.matiere)) {
          avertissements.push(`Matière "${f.matiere}" inconnue (fiche "${f.id}") — crée-la via l'import de matières.`)
        }
      })
    } else if (target === 'cas') {
      let ficheIds
      try {
        ficheIds = new Set(await getAllFicheIds())
      } catch {
        ficheIds = new Set()
      }
      items.forEach((c) => {
        ;(c.fiches_liees || []).forEach((refId) => {
          if (!ficheIds.has(refId)) {
            avertissements.push(`Fiche liée "${refId}" non résolue (dans le cas "${c.id}") — la fiche n'existe pas encore.`)
          }
        })
      })
    } else if (target === 'qcm') {
      let ficheIds, matiereNoms
      try {
        ficheIds = new Set(await getAllFicheIds())
      } catch {
        ficheIds = new Set()
      }
      try {
        matiereNoms = new Set(await getAllMatiereNoms())
      } catch {
        matiereNoms = new Set()
      }
      items.forEach((q) => {
        ;(q.fiches_liees || []).forEach((refId) => {
          if (!ficheIds.has(refId)) {
            avertissements.push(`Fiche liée "${refId}" non résolue (dans le QCM "${q.id}") — la fiche n'existe pas encore.`)
          }
        })
        ;(q.matieres || []).forEach((m) => {
          if (!matiereNoms.has(m)) {
            avertissements.push(`Matière "${m}" inconnue (QCM "${q.id}") — crée-la via l'import de matières.`)
          }
        })
      })
    }

    try {
      let inserted
      if (target === 'fiches') inserted = await insertFiches(items)
      else if (target === 'cas') inserted = await insertCas(items)
      else if (target === 'qcm') inserted = await insertQcm(items)
      else inserted = await insertMatieres(items)

      const labels = TARGET_LABELS[target]
      const nomsAjoutes = nouveaux === 1 ? labels.singulier : labels.pluriel
      let html = `<p class="import-status success">${nouveaux} ${nomsAjoutes} ${labels.ajoutees}, ${misesAJour} mis à jour (${inserted.length} au total).</p>`

      if (avertissements.length > 0) {
        html += `<div class="import-warnings"><p style="margin-bottom: 6px; font-size: 13px; color: var(--mecanisme);">${avertissements.length} avertissement${avertissements.length !== 1 ? 's' : ''} (import non bloqué) :</p><ul class="detail-list">${avertissements.map((a) => `<li>${a}</li>`).join('')}</ul></div>`
      }

      resultEl.innerHTML = html
      document.getElementById('json-input').value = ''
    } catch (err) {
      resultEl.innerHTML = `<p class="import-status error">Erreur : ${err.message}</p>`
    }
  })
}
