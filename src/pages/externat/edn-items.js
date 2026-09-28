import { getR2cItems, getR2cSdd, toggleR2cItemPrioritaire } from '../../lib/r2c.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'

// Items R2C + SDD (§4.1, lot 2) : liste, recherche, bascule du flag "prioritaire" (personnel,
// jamais déduit d'un import — voir §1 "Tu ne génères aucun contenu médical").
let ongletActuel = 'items'
let termeRecherche = ''

export async function renderEdnItems(container) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Items R2C</h2>
        <span class="count" id="edn-items-count"></span>
      </div>

      <div class="filters" id="edn-items-onglets">
        <button class="filter-btn ${ongletActuel === 'items' ? 'active' : ''}" data-onglet="items">Items</button>
        <button class="filter-btn ${ongletActuel === 'sdd' ? 'active' : ''}" data-onglet="sdd">Situations de départ</button>
      </div>

      <input type="text" id="edn-items-search" class="search-input" placeholder="Rechercher un numéro ou un intitulé…" value="${escapeHtml(termeRecherche)}" />

      <div id="edn-items-list" class="fiches-list"></div>
    </div>
  `

  document.getElementById('edn-items-onglets').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-onglet]')
    if (!btn || btn.dataset.onglet === ongletActuel) return
    ongletActuel = btn.dataset.onglet
    termeRecherche = ''
    renderEdnItems(container)
  })

  document.getElementById('edn-items-search').addEventListener('input', (e) => {
    termeRecherche = e.target.value
    afficherListe()
  })

  const listEl = document.getElementById('edn-items-list')
  const countEl = document.getElementById('edn-items-count')

  let lignes = []
  try {
    lignes = ongletActuel === 'items' ? await getR2cItems() : await getR2cSdd()
  } catch (err) {
    if (estTableAbsente(err)) {
      listEl.innerHTML = htmlMigrationManquante('001')
      return
    }
    listEl.innerHTML = `<p class="empty-note">Erreur : ${escapeHtml(err.message)}</p>`
    return
  }

  function afficherListe() {
    const terme = termeRecherche.trim().toLowerCase()
    const filtrees = terme
      ? lignes.filter((l) => String(l.numero).includes(terme) || l.intitule.toLowerCase().includes(terme))
      : lignes

    countEl.textContent = `${filtrees.length} / ${lignes.length}`

    if (filtrees.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucun résultat. ${lignes.length === 0 ? 'Importe la liste officielle depuis #import (voir la page Prompts).' : ''}</p>`
      return
    }

    listEl.innerHTML = filtrees
      .map((l) => {
        if (ongletActuel === 'items') {
          return `
            <div class="fiche-row">
              <div class="tab" style="background: ${l.prioritaire ? 'var(--mecanisme)' : 'var(--hairline)'};"></div>
              <div class="fiche-body">
                <div class="fiche-top">
                  <span class="fiche-title voice">${l.numero} — ${escapeHtml(l.intitule)}</span>
                </div>
                <div class="fiche-meta">${(l.specialites || []).map(escapeHtml).join(', ') || 'aucune spécialité'}</div>
              </div>
              <div class="fiche-actions">
                <button class="btn${l.prioritaire ? ' primary' : ''}" data-toggle-prioritaire="${l.numero}" style="width: auto;">
                  ${l.prioritaire ? '★ Prioritaire' : '☆ Marquer prioritaire'}
                </button>
              </div>
            </div>
          `
        }
        return `
          <div class="fiche-row">
            <div class="tab" style="background: var(--structure);"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${l.numero} — ${escapeHtml(l.intitule)}</span>
              </div>
              <div class="fiche-meta">${l.famille ? escapeHtml(l.famille) : 'aucune famille'}</div>
            </div>
          </div>
        `
      })
      .join('')

    listEl.querySelectorAll('[data-toggle-prioritaire]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const numero = parseInt(btn.dataset.togglePrioritaire, 10)
        const ligne = lignes.find((l) => l.numero === numero)
        const nouvelleValeur = !ligne.prioritaire
        btn.disabled = true
        try {
          await toggleR2cItemPrioritaire(numero, nouvelleValeur)
          ligne.prioritaire = nouvelleValeur
          afficherListe()
        } catch (err) {
          alert('Erreur : ' + err.message)
          btn.disabled = false
        }
      })
    })
  }

  afficherListe()
}
