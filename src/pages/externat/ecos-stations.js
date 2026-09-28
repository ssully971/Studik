import { getStations } from '../../lib/ecos.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { afficherLoader } from '../../lib/loader.js'
import { demarrerCircuitEcos } from './ecos-circuit.js'

// Liste des stations ECOS (§5.9, §8 lot 5) — recherche + filtre par domaine, ouvre le joueur
// #ecos-station/:id. Même structure que #edn-banque (recherche + filtres + fiches-list), pas de
// logique de liste dupliquée.
export async function renderEcosStations(container) {
  const arreterLoader = afficherLoader(container)

  let stations
  try {
    stations = await getStations()
  } catch (err) {
    arreterLoader()
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">ECOS</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }
  arreterLoader()

  const domaines = Array.from(new Set(stations.map((s) => s.domaine))).sort()

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">ECOS</h2>
        <span class="count" id="ecos-count"></span>
      </div>

      <input type="text" id="ecos-search" class="search-input" placeholder="Rechercher (titre)…" />

      <div class="filters" id="ecos-domaine-filters">
        <button class="filter-btn active" data-domaine="">Tous domaines</button>
        ${domaines.map((d) => `<button class="filter-btn" data-domaine="${escapeHtml(d)}">${escapeHtml(d)}</button>`).join('')}
      </div>

      <p class="import-hint">Coche une ou plusieurs stations pour les enchaîner en circuit (2:00 de transition entre chacune, §5.9).</p>
      <div class="import-actions">
        <button class="btn primary" id="lancer-circuit-btn" style="width: auto;" disabled>Lancer un circuit (0)</button>
      </div>

      <div id="ecos-list" class="fiches-list"></div>
    </div>
  `

  let terme = ''
  let domaine = ''
  const selection = new Set()

  function majBoutonCircuit() {
    const btn = document.getElementById('lancer-circuit-btn')
    btn.textContent = `Lancer un circuit (${selection.size})`
    btn.disabled = selection.size === 0
  }

  function ligneVisible(s) {
    if (domaine && s.domaine !== domaine) return false
    const t = terme.trim().toLowerCase()
    if (t && !(s.titre || '').toLowerCase().includes(t)) return false
    return true
  }

  function appliquerFiltres() {
    const filtrees = stations.filter(ligneVisible)
    document.getElementById('ecos-count').textContent = `${filtrees.length} / ${stations.length}`
    const listEl = document.getElementById('ecos-list')
    if (filtrees.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun résultat.</p>`
      return
    }
    listEl.innerHTML = filtrees
      .map(
        (s) => `
      <div class="fiche-row">
        <div class="tab" style="background: var(--structure);"></div>
        <label class="checkbox-label" style="width: auto; margin: 0 8px 0 0;">
          <input type="checkbox" data-select-circuit="${escapeHtml(s.id)}" ${selection.has(s.id) ? 'checked' : ''} />
        </label>
        <div class="fiche-body">
          <div class="fiche-top">
            <a href="#ecos-station/${encodeURIComponent(s.id)}" class="fiche-title voice" data-open>${escapeHtml(s.titre)}</a>
            <span class="type-label">${escapeHtml(s.domaine)}</span>
          </div>
          <div class="fiche-meta">${escapeHtml(s.interlocuteur)}${s.statut ? ` · ${escapeHtml(s.statut)}` : ''}</div>
        </div>
      </div>
    `
      )
      .join('')

    listEl.querySelectorAll('[data-select-circuit]').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = cb.dataset.selectCircuit
        if (e.target.checked) selection.add(id)
        else selection.delete(id)
        majBoutonCircuit()
      })
    })
  }

  document.getElementById('ecos-search').addEventListener('input', (e) => {
    terme = e.target.value
    appliquerFiltres()
  })

  document.getElementById('ecos-domaine-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-domaine]')
    if (!btn) return
    document.querySelectorAll('#ecos-domaine-filters .filter-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    domaine = btn.dataset.domaine
    appliquerFiltres()
  })

  document.getElementById('lancer-circuit-btn').addEventListener('click', () => {
    if (selection.size === 0) return
    // Ordre de sélection = ordre du circuit (Set conserve l'ordre d'insertion).
    demarrerCircuitEcos(Array.from(selection))
  })

  appliquerFiltres()
}
