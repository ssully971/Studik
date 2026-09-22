import { insertFiches, getAllFicheIds } from '../lib/fiches.js'
import { insertCas, getAllCasIds } from '../lib/cas.js'
import { insertMatieres, getAllMatiereIds, getAllMatiereNoms, getAllMatieresAvecSousMatieres } from '../lib/matieres.js'
import { insertQcm, getAllQcmIds } from '../lib/qcm.js'
import { getTags, getTagsAvecPerimetre, ajouterTag, supprimerTag, modifierPerimetreTag } from '../lib/tags.js'
import { getPeriodesDisponibles } from '../lib/periode.js'
import { slugify } from '../lib/slug.js'
import promptContexteMaitre from '../data/prompts/prompt-contexte-maitre.md?raw'
import promptClinique from '../data/prompts/prompt-fiche-clinique.md?raw'
import promptMecanisme from '../data/prompts/prompt-fiche-mecanisme.md?raw'
import promptStructure from '../data/prompts/prompt-fiche-structure.md?raw'
import promptCas from '../data/prompts/prompt-cas.md?raw'
import promptQcm from '../data/prompts/prompt-qcm.md?raw'
import readme from '../data/prompts/README-prompts.md?raw'

let mode = 'import'

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
  qcm: ['id', 'titre', 'questions'],
}

function detecterTypeImport(item) {
  if (!item || typeof item !== 'object') return null
  if (Array.isArray(item.questions)) return 'qcm'
  if (item.niveau !== undefined && item.question !== undefined) return 'cas'
  if (item.matiere !== undefined && item.titre !== undefined) return 'fiches'
  return null
}

const TARGET_LABELS = {
  fiches: { singulier: 'fiche', pluriel: 'fiches', ajoutees: 'ajoutées' },
  cas: { singulier: 'cas', pluriel: 'cas', ajoutees: 'ajoutés' },
  qcm: { singulier: 'QCM', pluriel: 'QCM', ajoutees: 'ajoutés' },
}

export async function renderImport(container, modeForce) {
  if (modeForce === 'prompts' || modeForce === 'import') mode = modeForce

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Import</h2>
      </div>

      <div class="filters" style="margin-bottom: 20px;">
        <button class="filter-btn ${mode === 'import' ? 'active' : ''}" data-mode="import">Importer</button>
        <button class="filter-btn ${mode === 'prompts' ? 'active' : ''}" data-mode="prompts">Prompts</button>
      </div>

      <div id="import-mode-content"></div>
    </div>
  `

  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === mode) return
      mode = btn.dataset.mode
      renderImport(container)
    })
  })

  const modeContent = document.getElementById('import-mode-content')
  if (mode === 'prompts') {
    await renderModePrompts(modeContent)
  } else {
    renderModeImport(modeContent)
  }
}

function renderModeImport(container) {
  container.innerHTML = `
    <div class="filters" id="target-filters">
      <button class="filter-btn active" data-target="fiches">Fiches</button>
      <button class="filter-btn" data-target="cas">Cas cliniques</button>
      <button class="filter-btn" data-target="qcm">QCM</button>
    </div>

    <p class="import-hint">
      Colle ici un tableau JSON (généré par Claude en chat). Le format attendu dépend du type sélectionné ci-dessus.
      Un id déjà existant met à jour l'élément plutôt que de le dupliquer. Les matières/sous-matières/cours se créent
      dans #organisation ; celles mentionnées mais absentes sont créées automatiquement ici.
    </p>

    <textarea id="json-input" class="json-textarea" placeholder='[{"id": "...", ...}]'></textarea>

    <div class="import-actions">
      <button id="import-btn" class="btn primary" style="width: auto;">Importer</button>
    </div>

    <div id="import-result"></div>
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
      else existingIds = await getAllQcmIds()
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

    // Crée les cours manquants rattachés directement à une matière (cas/QCM, qui n'ont pas de
    // sous_matiere) : entries = [{ nomMatiere, nomCours, type }].
    async function creerCoursManquants(entries) {
      if (entries.length === 0) return

      let matieresExistantes
      try {
        matieresExistantes = await getAllMatieresAvecSousMatieres()
      } catch {
        matieresExistantes = []
      }

      const nomsExistants = new Set(matieresExistantes.map((m) => m.nom))
      const idsExistants = new Set(matieresExistantes.map((m) => m.id))
      const idParNomMatiere = {}
      matieresExistantes.forEach((m) => {
        if (!m.parent_id) idParNomMatiere[m.nom] = m.id
      })

      const coursACreer = new Map()
      const parentParCoursNom = {}
      entries.forEach(({ nomMatiere, nomCours, type }) => {
        if (nomsExistants.has(nomCours)) return
        const id = slugify(nomCours)
        if (idsExistants.has(id) || coursACreer.has(id)) return
        const parentId = idParNomMatiere[nomMatiere]
        if (!parentId) return
        parentParCoursNom[nomCours] = nomMatiere
        coursACreer.set(id, { id, nom: nomCours, type, couleur: null, ordre_affichage: 0, annee: null, semestre: null, parent_id: parentId })
      })

      if (coursACreer.size > 0) {
        try {
          await insertMatieres(Array.from(coursACreer.values()))
          coursACreer.forEach((c) => infos.push(`Nouveau cours créé : ${c.nom} (sous ${parentParCoursNom[c.nom]})`))
        } catch (err) {
          avertissements.push(`Impossible de créer automatiquement le(s) cours manquant(s) : ${err.message}`)
        }
      }
    }

    let tagsConnus
    try {
      tagsConnus = new Set(await getTags())
    } catch {
      tagsConnus = new Set()
    }
    {
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

      if (items.some((f) => f.sous_matiere) || items.some((f) => f.cours)) {
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
        items
          .filter((f) => f.sous_matiere)
          .forEach((f) => {
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

        // Les cours dépendent des sous-matières ci-dessus (nouvelles ou déjà existantes) :
        // on complète les tables avant de les traiter à leur tour.
        sousMatieresACreer.forEach((s) => {
          idParNomParent[s.nom] = s.id
          nomsExistants.add(s.nom)
          idsExistants.add(s.id)
        })

        const coursACreer = new Map()
        const parentParCoursNom = {}
        items
          .filter((f) => f.cours)
          .forEach((f) => {
            if (nomsExistants.has(f.cours)) return
            const id = slugify(f.cours)
            if (idsExistants.has(id) || coursACreer.has(id)) return
            const nomParent = f.sous_matiere || f.matiere
            const parentId = idParNomParent[nomParent]
            if (!parentId) return
            parentParCoursNom[f.cours] = nomParent
            coursACreer.set(id, {
              id,
              nom: f.cours,
              type: f.type,
              couleur: null,
              ordre_affichage: 0,
              annee: null,
              semestre: null,
              parent_id: parentId,
            })
          })

        if (coursACreer.size > 0) {
          try {
            await insertMatieres(Array.from(coursACreer.values()))
            coursACreer.forEach((c) => infos.push(`Nouveau cours créé : ${c.nom} (sous ${parentParCoursNom[c.nom]})`))
          } catch (err) {
            avertissements.push(`Impossible de créer automatiquement le(s) cours manquant(s) : ${err.message}`)
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

      await creerCoursManquants(items.filter((c) => c.cours).map((c) => ({ nomMatiere: c.matiere, nomCours: c.cours, type: c.type })))
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
            avertissements.push(`Matière "${m}" inconnue (QCM "${q.id}") — crée-la via #organisation.`)
          }
        })
      })

      await creerCoursManquants(
        items.filter((q) => q.cours && q.matieres?.[0]).map((q) => ({ nomMatiere: q.matieres[0], nomCours: q.cours, type: 'clinique' }))
      )
    }

    try {
      let inserted
      if (target === 'fiches') inserted = await insertFiches(items)
      else if (target === 'cas') inserted = await insertCas(items)
      else inserted = await insertQcm(items)

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

// --- Prompts (ex-#prompts) ---

const PROMPTS = [
  { id: 'contexte-maitre', titre: 'Contexte maître (à coller avant les autres)', contenu: promptContexteMaitre },
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

async function renderModePrompts(container) {
  container.innerHTML = `
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
