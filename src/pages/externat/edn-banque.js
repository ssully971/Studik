import { getAllDossiers, getQuestionsIsolees, updateQuestion, updateDossier } from '../../lib/edn-content.js'
import { getTousLesEtatsSrs, suspendreCible } from '../../lib/edn-srs-data.js'
import { cibleQuestion, cibleDossier } from '../../lib/edn-tentatives.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { afficherLoader } from '../../lib/loader.js'
import { demarrerSessionExternat } from './edn-session.js'

const STATUTS = ['brouillon', 'valide', 'archive']

// Banque de questions/dossiers (§7.3) : liste + filtres, suspendre/réactiver le SRS, changer le
// statut, signaler une erreur (même principe que fiches.a_corriger), lien vers l'éditeur ZAP.
export async function renderEdnBanque(container) {
  const arreterLoader = afficherLoader(container)

  let dossiers, questions, srsMap
  try {
    ;[dossiers, questions, srsMap] = await Promise.all([getAllDossiers(), getQuestionsIsolees(), getTousLesEtatsSrs()])
  } catch (err) {
    arreterLoader()
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Banque</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }
  arreterLoader()

  const lignes = [
    ...dossiers.map((d) => ({ ...d, sorte: 'dossier', cible: cibleDossier(d.id), titreAffiche: d.titre, badge: d.type })),
    ...questions.map((q) => ({ ...q, sorte: 'question', cible: cibleQuestion(q.id), titreAffiche: q.enonce, badge: q.format })),
  ]

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Banque</h2>
        <span class="count" id="banque-count"></span>
      </div>

      <input type="text" id="banque-search" class="search-input" placeholder="Rechercher (titre, énoncé)…" />

      <div class="filters" id="banque-sorte-filters">
        <button class="filter-btn active" data-sorte="">Tout</button>
        <button class="filter-btn" data-sorte="dossier">Dossiers</button>
        <button class="filter-btn" data-sorte="question">Questions isolées</button>
      </div>

      <div class="filters">
        <select id="banque-statut" class="periode-select">
          <option value="">Tous statuts</option>
          ${STATUTS.map((s) => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="banque-tri" class="periode-select">
          <option value="titre">Trier : titre (A→Z)</option>
          <option value="statut">Trier : statut</option>
          <option value="format">Trier : format</option>
        </select>
        <button class="filter-btn" id="banque-corriger-btn">À corriger</button>
        <button class="filter-btn" id="banque-suspendues-btn">Suspendues du SRS</button>
      </div>

      <div class="import-actions">
        <button class="btn primary" id="banque-lancer-session-btn" style="width: auto;">Lancer une session sur ces résultats</button>
      </div>

      <div id="banque-list" class="fiches-list"></div>
    </div>
  `

  let terme = ''
  let sorte = ''
  let statut = ''
  let tri = 'titre'
  let filtreCorriger = false
  let filtreSuspendues = false
  let filtreesCourantes = []

  function comparerLignes(a, b) {
    if (tri === 'statut') return (a.statut || 'brouillon').localeCompare(b.statut || 'brouillon') || (a.titreAffiche || '').localeCompare(b.titreAffiche || '')
    if (tri === 'format') return (a.badge || '').localeCompare(b.badge || '') || (a.titreAffiche || '').localeCompare(b.titreAffiche || '')
    return (a.titreAffiche || '').localeCompare(b.titreAffiche || '')
  }

  function ligneVisible(l) {
    if (sorte && l.sorte !== sorte) return false
    if (statut && l.statut !== statut) return false
    if (filtreCorriger && !l.a_corriger) return false
    const etatSrs = srsMap[l.cible]
    if (filtreSuspendues && !(etatSrs && etatSrs.suspendue)) return false
    const t = terme.trim().toLowerCase()
    if (t && !(l.titreAffiche || '').toLowerCase().includes(t)) return false
    return true
  }

  function appliquerFiltres() {
    const filtrees = lignes.filter(ligneVisible).sort(comparerLignes)
    filtreesCourantes = filtrees
    document.getElementById('banque-count').textContent = `${filtrees.length} / ${lignes.length}`
    const lancerBtn = document.getElementById('banque-lancer-session-btn')
    if (lancerBtn) lancerBtn.disabled = filtrees.length === 0
    renderListe(filtrees)
  }

  function renderListe(liste) {
    const listEl = document.getElementById('banque-list')
    if (liste.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun résultat.</p>`
      return
    }

    listEl.innerHTML = liste
      .map((l) => {
        const suspendue = Boolean(srsMap[l.cible]?.suspendue)
        const href = l.sorte === 'dossier' ? `#edn-dossier/${encodeURIComponent(l.id)}` : `#edn-question/${encodeURIComponent(l.id)}`
        return `
        <div class="fiche-row">
          <div class="tab" style="background: ${l.a_corriger ? '#C46A5C' : 'var(--structure)'};"></div>
          <div class="fiche-body">
            <div class="fiche-top">
              <a href="${href}" class="fiche-title voice" data-open>${escapeHtml((l.titreAffiche || '').slice(0, 140))}</a>
              <span class="type-label">${escapeHtml(l.badge || '')}</span>
            </div>
            <div class="fiche-meta">${escapeHtml(l.statut || 'brouillon')}${suspendue ? ' · SRS suspendu' : ''}${l.a_corriger ? ' · à corriger' : ''}</div>
          </div>
          <div class="fiche-actions" style="gap: 6px; flex-wrap: wrap;">
            ${l.sorte === 'question' && l.format === 'ZAP' ? `<a href="#edn-zap/${encodeURIComponent(l.id)}" class="btn" style="width: auto;">Zones</a>` : ''}
            <select class="periode-select" data-statut-select="${l.cible}">
              ${STATUTS.map((s) => `<option value="${s}" ${l.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <button class="btn" data-toggle-suspendue="${l.cible}" style="width: auto;">${suspendue ? 'Réactiver' : 'Suspendre'}</button>
            <button class="btn" data-toggle-corriger="${l.cible}" style="width: auto;">${l.a_corriger ? 'Annuler le signalement' : 'Signaler'}</button>
          </div>
        </div>
      `
      })
      .join('')

    function ligneParCible(cible) {
      return lignes.find((l) => l.cible === cible)
    }

    listEl.querySelectorAll('[data-statut-select]').forEach((select) => {
      select.addEventListener('change', async (e) => {
        const l = ligneParCible(select.dataset.statutSelect)
        try {
          if (l.sorte === 'dossier') await updateDossier(l.id, { statut: e.target.value })
          else await updateQuestion(l.id, { statut: e.target.value })
          l.statut = e.target.value
        } catch (err) {
          alert('Erreur : ' + err.message)
        }
      })
    })

    listEl.querySelectorAll('[data-toggle-suspendue]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cible = btn.dataset.toggleSuspendue
        const suspendueActuelle = Boolean(srsMap[cible]?.suspendue)
        btn.disabled = true
        try {
          await suspendreCible(cible, !suspendueActuelle)
          srsMap[cible] = { ...(srsMap[cible] || { cible }), suspendue: !suspendueActuelle }
          appliquerFiltres()
        } catch (err) {
          alert('Erreur : ' + err.message)
          btn.disabled = false
        }
      })
    })

    listEl.querySelectorAll('[data-toggle-corriger]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const l = ligneParCible(btn.dataset.toggleCorriger)
        const nouveau = !l.a_corriger
        let note = null
        if (nouveau) note = window.prompt('Note optionnelle sur cette erreur :', '') || null
        btn.disabled = true
        try {
          const champs = { a_corriger: nouveau, note_correction: nouveau ? note : null }
          if (l.sorte === 'dossier') await updateDossier(l.id, champs)
          else await updateQuestion(l.id, champs)
          l.a_corriger = nouveau
          l.note_correction = champs.note_correction
          appliquerFiltres()
        } catch (err) {
          alert('Erreur : ' + err.message)
          btn.disabled = false
        }
      })
    })
  }

  document.getElementById('banque-search').addEventListener('input', (e) => {
    terme = e.target.value
    appliquerFiltres()
  })

  document.getElementById('banque-sorte-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sorte]')
    if (!btn) return
    document.querySelectorAll('#banque-sorte-filters .filter-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    sorte = btn.dataset.sorte
    appliquerFiltres()
  })

  document.getElementById('banque-statut').addEventListener('change', (e) => {
    statut = e.target.value
    appliquerFiltres()
  })

  document.getElementById('banque-tri').addEventListener('change', (e) => {
    tri = e.target.value
    appliquerFiltres()
  })

  document.getElementById('banque-lancer-session-btn').addEventListener('click', () => {
    if (filtreesCourantes.length === 0) return
    demarrerSessionExternat(filtreesCourantes, `Banque (${filtreesCourantes.length})`, 'entrainement')
  })

  document.getElementById('banque-corriger-btn').addEventListener('click', (e) => {
    filtreCorriger = !filtreCorriger
    e.target.classList.toggle('active', filtreCorriger)
    appliquerFiltres()
  })

  document.getElementById('banque-suspendues-btn').addEventListener('click', (e) => {
    filtreSuspendues = !filtreSuspendues
    e.target.classList.toggle('active', filtreSuspendues)
    appliquerFiltres()
  })

  appliquerFiltres()
}
