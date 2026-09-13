import {
  getFicheById,
  getFiches,
  updateNotesPerso,
  updateFicheTags,
  updateStatut,
  updateFicheLiens,
  deleteFiche,
  enregistrerRevision,
} from '../lib/fiches.js'
import { exporterFichePDF } from '../lib/pdf.js'
import { richText } from '../lib/richtext.js'

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
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
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
        <h1 class="voice">${fiche.titre}</h1>
        <div class="fiche-meta">
          ${fiche.matiere} · <span class="type-label">${fiche.type}</span>
        </div>
        ${fiche.tags.length ? `<div class="tags">${fiche.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
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
          </div>
        </div>

        <div class="fiche-sidebar">
          <div class="sidebar-tabs">
            <button class="sidebar-tab active" data-tab="liens">Liens</button>
            <button class="sidebar-tab" data-tab="notes">Notes perso</button>
            <button class="sidebar-tab" data-tab="gestion">Gestion</button>
          </div>

          <div class="sidebar-panel settings-card" data-panel="liens">
            <h3 class="voice">Liens vers d'autres fiches</h3>
            ${renderLienSection('pre_requis', 'Prérequis', preRequis, titresParId)}
            ${renderLienSection('consequences', 'Conséquences', consequences, titresParId)}
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
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Statut</label>
              <select id="statut-select" class="periode-select">
                <option value="brouillon" ${fiche.statut === 'brouillon' ? 'selected' : ''}>Brouillon</option>
                <option value="valide" ${fiche.statut === 'valide' ? 'selected' : ''}>Validé</option>
                <option value="a_revoir" ${fiche.statut === 'a_revoir' ? 'selected' : ''}>À revoir</option>
                <option value="archive" ${fiche.statut === 'archive' ? 'selected' : ''}>Archivé</option>
              </select>
            </div>

            <div style="margin-bottom: 14px;">
              <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Tags (séparés par des virgules)</label>
              <input type="text" id="tags-input" class="search-input" style="margin-bottom: 0;" value="${fiche.tags.join(', ')}" />
            </div>

            <div class="import-actions">
              <button id="save-gestion-btn" class="btn primary" style="width: auto;">Enregistrer</button>
              <button id="delete-fiche-btn" class="btn" style="width: auto; color: #C46A5C;">Supprimer la fiche</button>
              <span id="gestion-status" class="import-status"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

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
        ? matches.map((f) => `<div class="search-result-inline-item" data-add="${f.id}">${f.titre} <span class="fiche-meta">· ${f.matiere}</span></div>`).join('')
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

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !resultats.contains(e.target)) {
        resultats.classList.add('hidden')
      }
    })
  }

  rerenderLienSection('pre_requis', preRequis)
  rerenderLienSection('consequences', consequences)
  setupRechercheLien('pre_requis')
  setupRechercheLien('consequences')

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

  document.getElementById('save-notes').addEventListener('click', async () => {
    const statusEl = document.getElementById('notes-status')
    const value = document.getElementById('notes-perso').value
    try {
      await updateNotesPerso(fiche.id, value)
      statusEl.textContent = 'Enregistré.'
      statusEl.className = 'import-status success'
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.getElementById('save-gestion-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('gestion-status')
    const statut = document.getElementById('statut-select').value
    const tags = document
      .getElementById('tags-input')
      .value.split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      await updateStatut(fiche.id, statut)
      await updateFicheTags(fiche.id, tags)
      statusEl.textContent = 'Enregistré.'
      statusEl.className = 'import-status success'
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  document.getElementById('delete-fiche-btn').addEventListener('click', async () => {
    if (!window.confirm(`Supprimer définitivement la fiche "${fiche.titre}" ?`)) return
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
