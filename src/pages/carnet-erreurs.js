import { getTentativesRatees, marquerCommeRevu } from '../lib/cas.js'

const TYPE_LABELS = {
  clinique: 'clinique',
  mecanisme: 'mécanisme',
  structure: 'structure',
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export async function renderCarnetErreurs(container) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let tentatives
  try {
    tentatives = await getTentativesRatees()
  } catch (err) {
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${err.message}</p></div>`
    return
  }

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Carnet d'erreurs</h2>
        <span class="count" id="erreurs-count">${tentatives.length} erreur${tentatives.length !== 1 ? 's' : ''} à revoir</span>
      </div>

      <div id="erreurs-list" class="fiches-list"></div>
    </div>
  `

  renderList(tentatives)

  function renderList(list) {
    document.getElementById('erreurs-count').textContent = `${list.length} erreur${list.length !== 1 ? 's' : ''} à revoir`
    const listEl = document.getElementById('erreurs-list')

    if (list.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Aucune erreur à revoir pour l'instant.</p>`
      return
    }

    listEl.innerHTML = list
      .map((t) => {
        const cas = t.cas_cliniques
        if (!cas) return ''
        const fichesLiens = (cas.fiches_liees || [])
          .map((id) => `<a href="#fiche/${id}" class="btn" style="width: auto;">Fiche ${id}</a>`)
          .join('')

        return `
          <div class="fiche-row type-${cas.type}" data-tentative="${t.id}">
            <div class="tab"></div>
            <div class="fiche-body">
              <div class="fiche-top">
                <span class="fiche-title voice">${cas.question}</span>
                <span class="type-label">${TYPE_LABELS[cas.type]}</span>
              </div>
              <div class="fiche-meta">${cas.matiere} · ratée le ${formatDate(t.date_tentative)}</div>
              <div class="import-actions" style="margin-top: 10px;">
                <a href="#entrainement/${cas.id}" class="btn primary" style="width: auto;">Rejouer le cas</a>
                ${fichesLiens}
                <button class="btn" data-revu="${t.id}" style="width: auto;">Marquer comme revu</button>
              </div>
            </div>
          </div>
        `
      })
      .join('')

    listEl.querySelectorAll('[data-revu]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const tentativeId = btn.dataset.revu
        btn.disabled = true
        btn.textContent = '…'
        try {
          await marquerCommeRevu(tentativeId)
          tentatives = tentatives.filter((t) => t.id !== tentativeId)
          renderList(tentatives)
        } catch (err) {
          btn.textContent = 'Erreur'
        }
      })
    })
  }
}
