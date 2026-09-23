import {
  getFicheById,
  getFiches,
  updateNotesPerso,
  updateFicheTags,
  updateStatut,
  updateFicheLiens,
  updateFiche,
  deleteFiche,
  enregistrerRevision,
} from '../lib/fiches.js'
import { getMatieres, getSousMatieres, getEnfantsPartitionnes } from '../lib/matieres.js'
import { exporterFichePDF } from '../lib/pdf.js'
import { richText } from '../lib/richtext.js'
import { renderTagPicker } from './tag-picker.js'
import { appliquerSurlignageEnAttente } from '../lib/highlight.js'
import { televerserImage } from '../lib/images.js'
import { demanderConfirmation } from '../lib/confirmer.js'
import { escapeHtml } from '../lib/escape.js'
import { renderCoursAttachPicker } from './cours-attach-picker.js'

export function renderChamp(label, value) {
  if (!value) return ''
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    return `
      <div class="detail-section">
        <h3 class="voice">${label}</h3>
        <ul class="detail-list">
          ${value.map((v) => `<li>${richText(v)}</li>`).join('')}
        </ul>
      </div>
    `
  }
  return `
    <div class="detail-section">
      <h3 class="voice">${label}</h3>
      <p>${richText(value)}</p>
    </div>
  `
}

function formatRelatif(iso) {
  if (!iso) return 'Jamais revue'
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (jours === 0) return "Revue aujourd'hui"
  if (jours === 1) return 'Revue hier'
  return `Revue il y a ${jours} jours`
}

function renderLienSection(champ, titreSection, liste, titresParId) {
  const items = liste
    .map(
      (id) => `
      <div class="lien-item">
        <span>${titresParId[id] || id}</span>
        <button class="lien-remove" data-remove="${champ}" data-id="${id}">×</button>
      </div>
    `
    )
    .join('')

  return `
    <div style="margin-bottom: 18px;">
      <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 6px;">${titreSection}</label>
      <div class="liens-list" id="liens-${champ}">${items || '<p class="empty-note" style="padding: 4px 0;">Aucun</p>'}</div>
      <input type="text" class="search-input" id="recherche-${champ}" placeholder="Chercher une fiche à ajouter…" style="margin-top: 8px; margin-bottom: 0;" />
      <div class="search-results-inline hidden" id="resultats-${champ}"></div>
    </div>
  `
}

export async function renderFicheDetail(container, id) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let fiche, toutesLesFiches
  try {
    ;[fiche, toutesLesFiches] = await Promise.all([getFicheById(id), getFiches({})])
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }

  const autresFiches = toutesLesFiches.filter((f) => f.id !== fiche.id)
  const titresParId = {}
  toutesLesFiches.forEach((f) => {
    titresParId[f.id] = f.titre
  })

  let preRequis = [...(fiche.pre_requis || [])]
  let consequences = [...(fiche.consequences || [])]

  const contenu = fiche.contenu_structure || {}

  container.innerHTML = `
    <div class="wrap">
      <a href="#referentiel" class="breadcrumb">← Référentiel</a>

      <div class="detail-header type-${fiche.type}">
        <h1 class="voice">${escapeHtml(fiche.titre)}</h1>
        <div class="fiche-meta">
          ${fiche.matiere}${fiche.sous_matiere ? ' · ' + fiche.sous_matiere : ''} · <span class="type-label">${fiche.type}</span>
        </div>
        ${fiche.tags.length ? `<div class="tags">${fiche.tags.map((t) => `<a href="#tag/${encodeURIComponent(t)}" class="tag">${t}</a>`).join('')}</div>` : ''}
      </div>

      <div class="fiche-layout">
        <div class="fiche-main">
          <div class="detail-section settings-card" id="revision-rapide">
            <h3 class="voice">Révision rapide</h3>
            <p class="settings-desc" id="derniere-revision-txt">
              ${formatRelatif(fiche.date_derniere_revision)}${fiche.dernier_resultat ? ' · ' + (fiche.dernier_resultat === 'bien' ? "c'était bien" : 'pas top') : ''}
            </p>
            <div class="import-actions">
              <button id="revu-bien-btn" class="btn primary" style="width: auto;">C'était bien</button>
              <button id="revu-pas-bien-btn" class="btn" style="width: auto; color: #C46A5C;">Pas top, à revoir</button>
            </div>
          </div>

          ${Object.entries(contenu)
            .map(([key, value]) => renderChamp(key.replace(/_/g, ' '), value))
            .join('')}

          ${renderChamp('Pathologies associées', fiche.pathologies_associees)}

          <div class="actions-bar" style="margin-top: 20px;">
            <a href="#entrainement" class="btn primary" style="width: auto;">Lancer un cas</a>
            <button id="export-pdf-btn" class="btn" style="width: auto;">Exporter en PDF</button>
            <button id="export-json-btn" class="btn" style="width: auto;">Exporter en JSON</button>
          </div>
        </div>

        <div class="fiche-sidebar">
          <div class="sidebar-tabs">
            <button class="sidebar-tab active" data-tab="liens">Liens</button>
            <button class="sidebar-tab" data-tab="contenu">Contenu</button>
            <button class="sidebar-tab" data-tab="notes">Notes perso</button>
            <button class="sidebar-tab" data-tab="gestion">Gestion</button>
          </div>

          <div class="sidebar-panel settings-card" data-panel="liens">
            <h3 class="voice">Liens vers d'autres fiches</h3>
            ${renderLienSection('pre_requis', 'Prérequis', preRequis, titresParId)}
            ${renderLienSection('consequences', 'Conséquences', consequences, titresParId)}
          </div>

          <div class="sidebar-panel settings-card hidden" data-panel="contenu">
            <h3 class="voice">Contenu</h3>
            <div style="margin-bottom: 14px;">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Synonymes (séparés par des virgules)</label>
              <input type="text" id="synonymes-input" class="search-input" style="margin-bottom: 0;" value="${(fiche.synonymes || []).join(', ')}" />
            </div>
            ${Object.entries(contenu)
              .map(
                ([key, value]) => `
              <div style="margin-bottom: 14px;">
                <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">
                  ${key.replace(/_/g, ' ')}${Array.isArray(value) ? ' (une ligne = un élément)' : ''}
                </label>
                <textarea class="notes-textarea" data-champ-contenu="${key}" style="min-height: ${Array.isArray(value) ? '110px' : '70px'};">${
                  Array.isArray(value) ? value.join('\n') : value || ''
                }</textarea>
                <div class="import-actions" style="margin-top: 6px;">
                  <label class="btn" style="width: auto; cursor: pointer;">
                    Insérer une image
                    <input type="file" accept="image/*" data-image-pour="${key}" style="display: none;" />
                  </label>
                  <span class="import-status" data-image-status="${key}"></span>
                </div>
              </div>
            `
              )
              .join('')}
            <div style="margin-bottom: 14px;">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Pathologies associées (une ligne = un élément)</label>
              <textarea id="pathologies-input" class="notes-textarea" style="min-height: 110px;">${(fiche.pathologies_associees || []).join('\n')}</textarea>
            </div>
            <button id="save-contenu-btn" class="btn primary" style="width: auto;">Enregistrer le contenu</button>
            <span id="contenu-status" class="import-status"></span>
          </div>

          <div class="sidebar-panel settings-card hidden" data-panel="notes">
            <h3 class="voice">Notes perso</h3>
            <textarea id="notes-perso" class="notes-textarea" placeholder="Tes commentaires libres sur cette fiche…">${fiche.notes_perso || ''}</textarea>
            <button id="save-notes" class="btn" style="width: auto;">Enregistrer les notes</button>
            <span id="notes-status" class="import-status"></span>
          </div>

          <div class="sidebar-panel settings-card hidden" data-panel="gestion">
            <h3 class="voice">Gestion de la fiche</h3>

            <div style="margin-bottom: 14px;">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Matière</label>
              <select id="matiere-select" class="periode-select" style="width: 100%;"></select>
            </div>

            <div style="margin-bottom: 14px;" id="sous-matiere-wrapper">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Sous-matière (optionnel)</label>
              <select id="sous-matiere-select" class="periode-select" style="width: 100%;"></select>
            </div>

            <div style="margin-bottom: 14px;" id="cours-wrapper">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Cours (optionnel)</label>
              <select id="cours-select" class="periode-select" style="width: 100%;"></select>
            </div>

            <div style="margin-bottom: 14px;">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Emplacements supplémentaires (matière, sous-matière ou cours, en plus de celui ci-dessus)</label>
              <div id="cours-attach-picker"></div>
            </div>

            <div style="margin-bottom: 14px;">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Statut</label>
              <select id="statut-select" class="periode-select">
                <option value="brouillon" ${fiche.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
                <option value="valide" ${fiche.statut === 'valide' ? 'selected' : ''}>Validé</option>
                <option value="a_revoir" ${fiche.statut === 'a_revoir' ? 'selected' : ''}>À revoir</option>
                <option value="archive" ${fiche.statut === 'archive' ? 'selected' : ''}>Archivé</option>
              </select>
            </div>

            <div style="margin-bottom: 14px;">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Tags</label>
              <div id="tags-picker"></div>
            </div>

            <div class="import-actions">
              <button id="save-gestion-btn" class="btn primary" style="width: auto;">Enregistrer</button>
              <button id="archiver-btn" class="btn" style="width: auto;">Archiver</button>
              <button id="delete-fiche-btn" class="btn" style="width: auto; color: #C46A5C;">Supprimer la fiche</button>
              <span id="gestion-status" class="import-status"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  appliquerSurlignageEnAttente(container)

  // Écouteurs posés sur `wrap` (recréé à chaque rendu de cette page, donc jamais accumulé)
  // plutôt que sur `container` (#content, persistant sur toute la session) ou `document`.
  const wrap = container.querySelector('.wrap')

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('.img-toggle-btn')
    if (!btn) return
    btn.nextElementSibling?.classList.toggle('hidden')
  })

  // --- Onglets de la barre latérale ---
  document.querySelectorAll('.sidebar-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab').forEach((t) => t.classList.remove('active'))
      tab.classList.add('active')
      const cible = tab.dataset.tab
      document.querySelectorAll('.sidebar-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.panel !== cible)
      })
    })
  })

  // --- Liens ---
  async function sauvegarderLiens() {
    try {
      await updateFicheLiens(fiche.id, { pre_requis: preRequis, consequences: consequences })
    } catch (err) {
      alert('Erreur en enregistrant les liens : ' + err.message)
    }
  }

  function rerenderLienSection(champ, liste) {
    const wrapper = document.getElementById(`liens-${champ}`)
    wrapper.innerHTML = liste.length
      ? liste
          .map(
            (id) => `
        <div class="lien-item">
          <span>${titresParId[id] || id}</span>
          <button class="lien-remove" data-remove="${champ}" data-id="${id}">×</button>
        </div>
      `
          )
          .join('')
      : `<p class="empty-note" style="padding: 4px 0;">Aucun</p>`

    wrapper.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (champ === 'pre_requis') {
          preRequis = preRequis.filter((x) => x !== btn.dataset.id)
          rerenderLienSection('pre_requis', preRequis)
        } else {
          consequences = consequences.filter((x) => x !== btn.dataset.id)
          rerenderLienSection('consequences', consequences)
        }
        await sauvegarderLiens()
      })
    })
  }

  function setupRechercheLien(champ) {
    const input = document.getElementById(`recherche-${champ}`)
    const resultats = document.getElementById(`resultats-${champ}`)

    input.addEventListener('input', () => {
      const terme = input.value.trim().toLowerCase()
      if (!terme) {
        resultats.classList.add('hidden')
        resultats.innerHTML = ''
        return
      }

      const listeActuelle = champ === 'pre_requis' ? preRequis : consequences
      const matches = autresFiches
        .filter((f) => !listeActuelle.includes(f.id) && f.titre.toLowerCase().includes(terme))
        .slice(0, 6)

      resultats.innerHTML = matches.length
        ? matches.map((f) => `<div class="search-result-inline-item" data-add="${f.id}">${escapeHtml(f.titre)} <span class="fiche-meta">· ${escapeHtml(f.matiere)}</span></div>`).join('')
        : `<div class="search-result-inline-item empty">Aucun résultat</div>`
      resultats.classList.remove('hidden')

      resultats.querySelectorAll('[data-add]').forEach((el) => {
        el.addEventListener('click', async () => {
          const idAjoute = el.dataset.add
          if (champ === 'pre_requis') {
            preRequis.push(idAjoute)
            rerenderLienSection('pre_requis', preRequis)
          } else {
            consequences.push(idAjoute)
            rerenderLienSection('consequences', consequences)
          }
          input.value = ''
          resultats.classList.add('hidden')
          resultats.innerHTML = ''
          await sauvegarderLiens()
        })
      })
    })

    wrap.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !resultats.contains(e.target)) {
        resultats.classList.add('hidden')
      }
    })
  }

  rerenderLienSection('pre_requis', preRequis)
  rerenderLienSection('consequences', consequences)
  setupRechercheLien('pre_requis')
  setupRechercheLien('consequences')

  // --- Tags ---
  let tagsActuels = [...fiche.tags]
  renderTagPicker(document.getElementById('tags-picker'), {
    selected: tagsActuels,
    onChange: (nouveauxTags) => {
      tagsActuels = nouveauxTags
    },
  })

  // --- Révision rapide ---
  async function marquerRevision(resultat) {
    try {
      await enregistrerRevision(fiche.id, resultat)
      fiche.date_derniere_revision = new Date().toISOString()
      fiche.dernier_resultat = resultat
      fiche.statut = resultat === 'bien' ? 'valide' : 'a_revoir'
      document.getElementById('derniere-revision-txt').textContent =
        formatRelatif(fiche.date_derniere_revision) + (resultat === 'bien' ? " · c'était bien" : ' · pas top')
      document.getElementById('statut-select').value = fiche.statut
    } catch (err) {
      alert('Erreur : ' + err.message)
    }
  }

  document.getElementById('revu-bien-btn').addEventListener('click', () => marquerRevision('bien'))
  document.getElementById('revu-pas-bien-btn').addEventListener('click', () => marquerRevision('pas_bien'))

  document.getElementById('export-pdf-btn').addEventListener('click', () => {
    exporterFichePDF(fiche)
  })

  document.getElementById('export-json-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify([fiche], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fiche.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  })

  let matieresDisponibles = []
  let aDesSousMatieres = false
  let sousMatieresDisponibles = []
  let coursDirectsMatiere = []

  // Enfants directs d'une matière, partitionnés entre vraies sous-matières et cours qui y sont
  // directement rattachés (une matière peut sauter la couche sous-matière).
  async function chargerSousMatieres(nomMatiere, sousMatiereSelectionnee) {
    const wrapper = document.getElementById('sous-matiere-wrapper')
    const select = document.getElementById('sous-matiere-select')
    const matiereInfo = matieresDisponibles.find((m) => m.nom === nomMatiere)

    sousMatieresDisponibles = []
    coursDirectsMatiere = []
    try {
      if (matiereInfo) {
        const partition = await getEnfantsPartitionnes(matiereInfo.id)
        sousMatieresDisponibles = partition.sousMatieres
        coursDirectsMatiere = partition.coursDirects
      }
    } catch {
      // silencieux
    }

    aDesSousMatieres = sousMatieresDisponibles.length > 0

    if (!aDesSousMatieres) {
      wrapper.style.display = 'none'
      select.innerHTML = ''
      return
    }

    wrapper.style.display = ''
    select.innerHTML =
      `<option value="">Aucune</option>` +
      sousMatieresDisponibles.map((s) => `<option value="${escapeHtml(s.nom)}" ${s.nom === sousMatiereSelectionnee ? 'selected' : ''}>${escapeHtml(s.nom)}</option>`).join('')
  }

  // Un cours est enfant de la sous-matière choisie, ou directement de la matière si elle n'a
  // pas de sous-matières.
  async function chargerCours(nomMatiere, nomSousMatiere, coursSelectionne) {
    const wrapper = document.getElementById('cours-wrapper')
    const select = document.getElementById('cours-select')

    // Une matière peut mélanger sous-matières et cours directement rattachés : dès qu'aucune
    // sous-matière n'est choisie, on retombe sur les cours directs de la matière, même si elle
    // a par ailleurs des sous-matières (sinon ces cours directs deviennent inaccessibles).
    let cours = []
    if (nomSousMatiere) {
      const sousMatiereInfo = sousMatieresDisponibles.find((s) => s.nom === nomSousMatiere)
      if (sousMatiereInfo) {
        try {
          cours = await getSousMatieres(sousMatiereInfo.id)
        } catch {
          cours = []
        }
      }
    } else {
      cours = coursDirectsMatiere
    }

    if (cours.length === 0) {
      wrapper.style.display = 'none'
      select.innerHTML = ''
      return
    }

    wrapper.style.display = ''
    select.innerHTML =
      `<option value="">Aucun</option>` +
      cours.map((c) => `<option value="${escapeHtml(c.nom)}" ${c.nom === coursSelectionne ? 'selected' : ''}>${escapeHtml(c.nom)}</option>`).join('')
  }

  try {
    matieresDisponibles = await getMatieres({})
    const matiereSelect = document.getElementById('matiere-select')
    matiereSelect.innerHTML = matieresDisponibles.map((m) => `<option value="${escapeHtml(m.nom)}" ${m.nom === fiche.matiere ? 'selected' : ''}>${escapeHtml(m.nom)}</option>`).join('')
    await chargerSousMatieres(fiche.matiere, fiche.sous_matiere)
    await chargerCours(fiche.matiere, fiche.sous_matiere, fiche.cours)
    matiereSelect.addEventListener('change', async () => {
      await chargerSousMatieres(matiereSelect.value, null)
      await chargerCours(matiereSelect.value, null, null)
    })
    document.getElementById('sous-matiere-select').addEventListener('change', (e) => {
      chargerCours(matiereSelect.value, e.target.value, null)
    })
  } catch {
    // silencieux
  }

  renderCoursAttachPicker(document.getElementById('cours-attach-picker'), { type: 'fiche', id: fiche.id })

  document.getElementById('archiver-btn').addEventListener('click', async () => {
    if (!(await demanderConfirmation(`Archiver la fiche "${fiche.titre}" ?`))) return
    try {
      await updateStatut(fiche.id, 'archive')
      fiche.statut = 'archive'
      document.getElementById('statut-select').value = 'archive'
      document.getElementById('gestion-status').textContent = 'Fiche archivée.'
      document.getElementById('gestion-status').className = 'import-status success'
    } catch (err) {
      alert('Erreur : ' + err.message)
    }
  })

  async function sauvegarderNotes(messageSucces) {
    const statusEl = document.getElementById('notes-status')
    const value = document.getElementById('notes-perso').value
    try {
      await updateNotesPerso(fiche.id, value)
      statusEl.textContent = messageSucces
      statusEl.className = 'import-status success'
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  }

  document.getElementById('save-notes').addEventListener('click', () => sauvegarderNotes('Enregistré.'))

  let notesDebounceTimer = null
  document.getElementById('notes-perso').addEventListener('input', () => {
    clearTimeout(notesDebounceTimer)
    notesDebounceTimer = setTimeout(() => sauvegarderNotes('Enregistré automatiquement.'), 1800)
  })

  document.getElementById('save-gestion-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('gestion-status')
    const statut = document.getElementById('statut-select').value
    const matiere = document.getElementById('matiere-select').value
    const sous_matiere = document.getElementById('sous-matiere-select').value || null
    const cours = document.getElementById('cours-select').value || null

    try {
      await updateStatut(fiche.id, statut)
      await updateFicheTags(fiche.id, tagsActuels)
      const champsMatiere = {}
      if (matiere && matiere !== fiche.matiere) champsMatiere.matiere = matiere
      if (sous_matiere !== (fiche.sous_matiere || null)) champsMatiere.sous_matiere = sous_matiere
      if (cours !== (fiche.cours || null)) champsMatiere.cours = cours
      if (Object.keys(champsMatiere).length > 0) {
        await updateFiche(fiche.id, champsMatiere)
        Object.assign(fiche, champsMatiere)
      }
      statusEl.textContent = 'Enregistré.'
      statusEl.className = 'import-status success'
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.querySelectorAll('[data-image-pour]').forEach((input) => {
    input.addEventListener('change', async () => {
      const key = input.dataset.imagePour
      const file = input.files[0]
      if (!file) return

      const statusEl = document.querySelector(`[data-image-status="${key}"]`)
      const textarea = document.querySelector(`[data-champ-contenu="${key}"]`)
      statusEl.textContent = 'Compression et envoi…'
      statusEl.className = 'import-status'

      try {
        const url = await televerserImage(file)
        const marqueur = `[[img:${url}]]`
        const debut = textarea.selectionStart ?? textarea.value.length
        const fin = textarea.selectionEnd ?? textarea.value.length
        textarea.value = textarea.value.slice(0, debut) + marqueur + textarea.value.slice(fin)
        statusEl.textContent = 'Image ajoutée — pense à "Enregistrer le contenu".'
        statusEl.className = 'import-status success'
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message
        statusEl.className = 'import-status error'
      }
      input.value = ''
    })
  })

  document.getElementById('save-contenu-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('contenu-status')
    const synonymes = document
      .getElementById('synonymes-input')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const nouveauContenu = {}
    document.querySelectorAll('[data-champ-contenu]').forEach((textarea) => {
      const key = textarea.dataset.champContenu
      if (Array.isArray(contenu[key])) {
        nouveauContenu[key] = textarea.value
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      } else {
        nouveauContenu[key] = textarea.value
      }
    })

    const pathologiesAssociees = document
      .getElementById('pathologies-input')
      .value.split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    try {
      await updateFiche(fiche.id, { synonymes, contenu_structure: nouveauContenu, pathologies_associees: pathologiesAssociees })
      renderFicheDetail(container, fiche.id)
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.getElementById('delete-fiche-btn').addEventListener('click', async () => {
    if (!(await demanderConfirmation(`Supprimer définitivement la fiche "${fiche.titre}" ?`))) return
    try {
      await deleteFiche(fiche.id)
      window.location.hash = '#referentiel'
    } catch (err) {
      const statusEl = document.getElementById('gestion-status')
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })
}
