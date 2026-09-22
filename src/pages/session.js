import { getFichesARevoir, enregistrerRevision } from '../lib/fiches.js'
import { getTentativesRatees, getCasById } from '../lib/cas.js'
import { renderChamp } from './fiche-detail.js'
import { renderCas } from './entrainement.js'
import { escapeHtml } from '../lib/escape.js'

function melanger(array) {
  const copie = [...array]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

export async function renderSession(container) {
  container.innerHTML = `<div class="wrap"><div id="session-content"></div></div>`
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.img-toggle-btn')
    if (!btn) return
    btn.nextElementSibling?.classList.toggle('hidden')
  })
  renderChoixTaille(document.getElementById('session-content'))
}

function renderChoixTaille(content) {
  content.innerHTML = `
    <div class="section-head">
      <h2 class="voice">Session de révision</h2>
    </div>
    <p class="settings-desc">Combien d'éléments pour cette session ?</p>
    <div class="import-actions">
      <button class="btn primary" data-taille="5">5 éléments</button>
      <button class="btn primary" data-taille="10">10 éléments</button>
      <button class="btn primary" data-taille="20">20 éléments</button>
    </div>
  `

  content.querySelectorAll('[data-taille]').forEach((btn) => {
    btn.addEventListener('click', () => demarrerSession(content, parseInt(btn.dataset.taille, 10)))
  })
}

async function demarrerSession(content, taille) {
  content.innerHTML = `<p class="voice">Préparation de la session…</p>`

  let fiches, tentatives
  try {
    ;[fiches, tentatives] = await Promise.all([getFichesARevoir({}), getTentativesRatees()])
  } catch (err) {
    content.innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
    return
  }

  const elements = [
    ...fiches.map((f) => ({ type: 'fiche', data: f })),
    ...tentatives.map((t) => ({ type: 'cas', data: t })),
  ]

  if (elements.length === 0) {
    content.innerHTML = `
      <div class="section-head"><h2 class="voice">Session de révision</h2></div>
      <p class="empty-note">Rien à réviser pour l'instant : aucune fiche à revoir, aucun cas raté.</p>
      <a href="#accueil" class="btn primary" style="width: auto;">Retour à l'accueil</a>
    `
    return
  }

  const file = melanger(elements).slice(0, taille)
  const stats = { fiches: 0, cas: 0 }
  let index = 0

  function avancer() {
    index += 1
    afficherElement()
  }

  function afficherElement() {
    if (index >= file.length) {
      afficherResume()
      return
    }
    const item = file[index]
    if (item.type === 'fiche') {
      afficherFiche(item.data)
    } else {
      afficherCas(item.data)
    }
  }

  function afficherFiche(fiche) {
    const contenu = fiche.contenu_structure || {}
    content.innerHTML = `
      <div class="section-head">
        <h2 class="voice">Session de révision</h2>
        <span class="count">${index + 1} / ${file.length}</span>
      </div>

      <div class="detail-header type-${fiche.type}">
        <h1 class="voice">${escapeHtml(fiche.titre)}</h1>
        <div class="fiche-meta">${escapeHtml(fiche.matiere)} · <span class="type-label">${fiche.type}</span></div>
      </div>

      ${Object.entries(contenu)
        .map(([key, value]) => renderChamp(key.replace(/_/g, ' '), value))
        .join('')}
      ${renderChamp('Pathologies associées', fiche.pathologies_associees)}

      <div class="import-actions" style="margin-top: 20px;">
        <button id="revu-bien-btn" class="btn primary" style="width: auto;">C'était bien</button>
        <button id="revu-pas-bien-btn" class="btn" style="width: auto; color: #C46A5C;">Pas top, à revoir</button>
      </div>
      <div class="import-actions">
        <button id="suivant-btn" class="btn" style="width: auto;" disabled>Suivant</button>
      </div>
    `

    async function marquer(resultat) {
      try {
        await enregistrerRevision(fiche.id, resultat)
        stats.fiches += 1
        document.getElementById('revu-bien-btn').disabled = true
        document.getElementById('revu-pas-bien-btn').disabled = true
        document.getElementById('suivant-btn').disabled = false
      } catch (err) {
        alert('Erreur : ' + err.message)
      }
    }

    document.getElementById('revu-bien-btn').addEventListener('click', () => marquer('bien'))
    document.getElementById('revu-pas-bien-btn').addEventListener('click', () => marquer('pas_bien'))
    document.getElementById('suivant-btn').addEventListener('click', avancer)
  }

  async function afficherCas(tentative) {
    content.innerHTML = `
      <div class="section-head">
        <h2 class="voice">Session de révision</h2>
        <span class="count">${index + 1} / ${file.length}</span>
      </div>
      <div id="session-cas-container"><p class="voice">Chargement du cas…</p></div>
      <div class="import-actions">
        <button id="suivant-btn" class="btn" style="width: auto;" disabled>Suivant</button>
      </div>
    `

    document.getElementById('suivant-btn').addEventListener('click', avancer)

    let cas
    try {
      cas = await getCasById(tentative.cas_id)
    } catch (err) {
      document.getElementById('session-cas-container').innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
      return
    }

    renderCas(document.getElementById('session-cas-container'), cas, {
      onValide: () => {
        stats.cas += 1
        const suivantBtn = document.getElementById('suivant-btn')
        if (suivantBtn) suivantBtn.disabled = false
      },
      onAutreCas: avancer,
    })
  }

  function afficherResume() {
    content.innerHTML = `
      <div class="section-head"><h2 class="voice">Session terminée</h2></div>
      <p class="settings-desc">
        ${stats.fiches} fiche${stats.fiches !== 1 ? 's' : ''} revue${stats.fiches !== 1 ? 's' : ''},
        ${stats.cas} cas retenté${stats.cas !== 1 ? 's' : ''}.
      </p>
      <a href="#accueil" class="btn primary" style="width: auto;">Retour à l'accueil</a>
    `
  }

  afficherElement()
}
