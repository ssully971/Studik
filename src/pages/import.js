import { insertFiches, getAllFicheIds } from '../lib/fiches.js'
import { insertCas, getAllCasIds } from '../lib/cas.js'
import { insertMatieres, getAllMatiereIds, getAllMatiereNoms, getAllMatieresAvecSousMatieres } from '../lib/matieres.js'
import { insertQcm, getAllQcmIds } from '../lib/qcm.js'
import { getTags, ajouterTag } from '../lib/tags.js'
import { slugify } from '../lib/slug.js'

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

function detecterTypeImport(item) {
  if (!item || typeof item !== 'object') return null
  if (Array.isArray(item.questions)) return 'qcm'
  if (item.niveau !== undefined && item.question !== undefined) return 'cas'
  if (item.nom !== undefined && item.type !== undefined && item.titre === undefined && item.matiere === undefined) return 'matieres'
  if (item.matiere !== undefined && item.titre !== undefined) return 'fiches'
  return null
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

  document.getElementById('json-input').addEventListener('input', () => {
    const raw = document.getElementById('json-input').value.trim()
    if (!raw) return

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }

    const items = Array.isArray(parsed) ? parsed : [parsed]
    if (items.length === 0) return

    const detected = detecterTypeImport(items[0])
    if (!detected || detected === target) return

    target = detected
    document.querySelectorAll('#target-filters .filter-btn').forEach((b) => b.classList.toggle('active', b.dataset.target === detected))
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

    const idManquantIndex = items.findIndex((item) => item.id === undefined || item.id === null || item.id === '')
    if (idManquantIndex !== -1) {
      resultEl.innerHTML = `<p class="import-status error">Élément n°${idManquantIndex + 1} incomplet — le champ "id" est obligatoire.</p>`
      return
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

    // Un id déjà existant est une mise à jour partielle (upsert) : seuls les champs présents
    // sont écrasés, donc seuls les NOUVEAUX éléments doivent respecter tous les champs obligatoires.
    const requiredFields = REQUIRED_FIELDS[target]
    const incompleteIndex = items.findIndex(
      (item) => !existingSet.has(item.id) && requiredFields.some((f) => item[f] === undefined || item[f] === null || item[f] === '')
    )
    if (incompleteIndex !== -1) {
      resultEl.innerHTML = `<p class="import-status error">Élément n°${incompleteIndex + 1} incomplet — champs obligatoires pour un nouvel élément : ${requiredFields.join(', ')}.</p>`
      return
    }

    if (target === 'qcm') {
      const sansQuestions = items.findIndex(
        (q) => !existingSet.has(q.id) && (!Array.isArray(q.questions) || q.questions.length === 0)
      )
      if (sansQuestions !== -1) {
        resultEl.innerHTML = `<p class="import-status error">QCM n°${sansQuestions + 1} : le tableau "questions" doit contenir au moins une question.</p>`
        return
      }
    }

    const avertissements = []
    const infos = []

    let tagsConnus
    try {
      tagsConnus = new Set(await getTags())
    } catch {
      tagsConnus = new Set()
    }
    if (target === 'fiches' || target === 'cas' || target === 'qcm') {
      const nouveauxTags = new Set()
      items.forEach((item) => {
        ;(item.tags || []).forEach((t) => {
          if (!tagsConnus.has(t)) nouveauxTags.add(t)
        })
      })
      if (nouveauxTags.size > 0) {
        try {
          for (const t of nouveauxTags) {
            await ajouterTag(t)
            tagsConnus.add(t)
          }
          infos.push(`${nouveauxTags.size} nouveau${nouveauxTags.size !== 1 ? 'x' : ''} tag${nouveauxTags.size !== 1 ? 's' : ''} créé${nouveauxTags.size !== 1 ? 's' : ''} : ${Array.from(nouveauxTags).join(', ')}`)
        } catch (err) {
          avertissements.push(`Impossible de créer automatiquement certains tags : ${err.message}`)
        }
      }
    }

    if (target === 'fiches') {
      const idsConnus = new Set([...existingIds, ...items.map((i) => i.id)])
      items.forEach((f) => {
        ;[...(f.pre_requis || []), ...(f.consequences || [])].forEach((refId) => {
          if (!idsConnus.has(refId)) {
            avertissements.push(`Lien vers "${refId}" non résolu (dans la fiche "${f.id}") — la fiche n'existe pas encore.`)
          }
        })
      })

      let matiereNoms, matiereIds
      try {
        ;[matiereNoms, matiereIds] = await Promise.all([getAllMatiereNoms(), getAllMatiereIds()])
        matiereNoms = new Set(matiereNoms)
        matiereIds = new Set(matiereIds)
      } catch {
        matiereNoms = new Set()
        matiereIds = new Set()
      }

      // Clé par id (slug) : deux noms qui se slugifient à l'identique (accents/casse
      // différents) désignent la même ligne réelle — les traiter comme "manquants" sur leur
      // nom exact écraserait le nom déjà en base via l'upsert.
      const matieresACreer = new Map()
      items.forEach((f) => {
        if (matiereNoms.has(f.matiere)) return
        const id = slugify(f.matiere)
        if (matiereIds.has(id) || matieresACreer.has(id)) return
        matieresACreer.set(id, {
          id,
          nom: f.matiere,
          type: f.type,
          couleur: null,
          ordre_affichage: 0,
          annee: null,
          semestre: null,
        })
      })

      if (matieresACreer.size > 0) {
        try {
          await insertMatieres(Array.from(matieresACreer.values()))
          matieresACreer.forEach((m) => infos.push(`Nouvelle matière créée : ${m.nom}`))
        } catch (err) {
          avertissements.push(`Impossible de créer automatiquement la/les matière(s) manquante(s) : ${err.message}`)
        }
      }

      const itemsAvecSousMatiere = items.filter((f) => f.sous_matiere)
      if (itemsAvecSousMatiere.length > 0) {
        let matieresExistantes
        try {
          matieresExistantes = await getAllMatieresAvecSousMatieres()
        } catch {
          matieresExistantes = []
        }

        const nomsExistants = new Set(matieresExistantes.map((m) => m.nom))
        const idsExistants = new Set(matieresExistantes.map((m) => m.id))
        const idParNomParent = {}
        matieresExistantes.forEach((m) => {
          if (!m.parent_id) idParNomParent[m.nom] = m.id
        })
        matieresACreer.forEach((m) => {
          idParNomParent[m.nom] = m.id
        })

        const sousMatieresACreer = new Map()
        const matiereParSousNom = {}
        itemsAvecSousMatiere.forEach((f) => {
          if (nomsExistants.has(f.sous_matiere)) return
          const id = slugify(f.sous_matiere)
          if (idsExistants.has(id) || sousMatieresACreer.has(id)) return
          const parentId = idParNomParent[f.matiere]
          if (!parentId) return
          matiereParSousNom[f.sous_matiere] = f.matiere
          sousMatieresACreer.set(id, {
            id,
            nom: f.sous_matiere,
            type: f.type,
            couleur: null,
            ordre_affichage: 0,
            annee: null,
            semestre: null,
            parent_id: parentId,
          })
        })

        if (sousMatieresACreer.size > 0) {
          try {
            await insertMatieres(Array.from(sousMatieresACreer.values()))
            sousMatieresACreer.forEach((s) => infos.push(`Nouvelle sous-matière créée : ${s.nom} (sous ${matiereParSousNom[s.nom]})`))
          } catch (err) {
            avertissements.push(`Impossible de créer automatiquement la/les sous-matière(s) manquante(s) : ${err.message}`)
          }
        }
      }
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

      if (infos.length > 0) {
        html += `<div class="import-warnings"><p style="margin-bottom: 6px; font-size: 13px; color: var(--text-dim);">${infos.length} information${infos.length !== 1 ? 's' : ''} :</p><ul class="detail-list">${infos.map((i) => `<li>${i}</li>`).join('')}</ul></div>`
      }

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
