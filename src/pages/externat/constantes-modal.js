import { getConstantes } from '../../lib/constantes-bio.js'
import { estTableAbsente, messageMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'

// Modale "Constantes biologiques" (§8 lot 6) : accessible depuis tous les écrans externat (bouton
// flottant posé une fois dans la coquille de l'app, voir main.js) — jamais une page à part, pour
// rester consultable sans perdre le contexte de la question/du dossier en cours. Un seul appel
// réseau par session (cache module), les valeurs ne changent jamais en cours de session.
let cache = null

function grouperParCategorie(constantes) {
  const groupes = new Map()
  constantes.forEach((c) => {
    if (!groupes.has(c.categorie)) groupes.set(c.categorie, [])
    groupes.get(c.categorie).push(c)
  })
  return groupes
}

export async function ouvrirModaleConstantes() {
  const overlay = document.getElementById('constantes-modal-overlay')
  const contentEl = document.getElementById('constantes-modal-content')
  if (!overlay || !contentEl) return
  overlay.classList.remove('hidden')

  if (cache) {
    afficherConstantes(contentEl, cache)
    return
  }

  contentEl.innerHTML = `<p class="voice">Chargement…</p>`
  try {
    cache = await getConstantes()
  } catch (err) {
    contentEl.innerHTML = estTableAbsente(err)
      ? `<p class="empty-note">${messageMigrationManquante('001')}</p>`
      : `<p class="empty-note">Erreur : ${escapeHtml(err.message)}</p>`
    return
  }
  afficherConstantes(contentEl, cache)
}

function afficherConstantes(contentEl, constantes) {
  if (constantes.length === 0) {
    contentEl.innerHTML = `<p class="empty-note">Aucune constante importée pour l'instant (prompt "Constantes biologiques", page Prompts).</p>`
    return
  }

  const groupes = grouperParCategorie(constantes)
  contentEl.innerHTML = Array.from(groupes.entries())
    .map(
      ([categorie, items]) => `
    <h3 class="voice">${escapeHtml(categorie)}</h3>
    <table class="rt-table">
      <thead><tr><th>Paramètre</th><th>Valeur normale</th><th>Unité</th></tr></thead>
      <tbody>
        ${items
          .map(
            (c) => `<tr><td>${escapeHtml(c.parametre)}</td><td>${escapeHtml(c.valeur_normale)}</td><td>${escapeHtml(c.unite || '')}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
    )
    .join('')
}

export function fermerModaleConstantes() {
  document.getElementById('constantes-modal-overlay')?.classList.add('hidden')
}

export function toggleModaleConstantes() {
  const overlay = document.getElementById('constantes-modal-overlay')
  if (!overlay) return
  if (overlay.classList.contains('hidden')) ouvrirModaleConstantes()
  else fermerModaleConstantes()
}
