import { ajouterCapture, getCapturesNonTraitees, marquerCaptureTraitee, supprimerCapture } from '../lib/captures.js'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export async function renderCapture(container) {
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Capture rapide</h2>
      </div>

      <p class="import-hint">Note une info en vitesse, tu la transformeras en fiche plus tard.</p>

      <textarea id="capture-input" class="json-textarea" style="min-height: 100px; font-family: 'IBM Plex Sans', sans-serif;" placeholder="Ex : le prof a insisté sur..."></textarea>

      <div class="import-actions">
        <button id="capture-save-btn" class="btn primary" style="width: auto;">Enregistrer</button>
        <span id="capture-status" class="import-status"></span>
      </div>

      <div class="section-head" style="margin-top: 40px;">
        <h2 class="voice">Pas encore traitées</h2>
        <span class="count" id="captures-count"></span>
      </div>
      <div id="captures-list" class="fiches-list"></div>
    </div>
  `

  const textarea = document.getElementById('capture-input')

  document.getElementById('capture-save-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('capture-status')
    const texte = textarea.value.trim()

    if (!texte) {
      statusEl.textContent = 'Écris quelque chose avant d\'enregistrer.'
      statusEl.className = 'import-status error'
      return
    }

    try {
      await ajouterCapture(texte)
      textarea.value = ''
      statusEl.textContent = 'Enregistré.'
      statusEl.className = 'import-status success'
      loadCaptures()
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + err.message
      statusEl.className = 'import-status error'
    }
  })

  async function loadCaptures() {
    const listEl = document.getElementById('captures-list')
    let captures
    try {
      captures = await getCapturesNonTraitees()
    } catch (err) {
      listEl.innerHTML = `<p class="empty-note">Erreur : ${err.message}</p>`
      return
    }

    document.getElementById('captures-count').textContent = `${captures.length} note${captures.length !== 1 ? 's' : ''}`

    if (captures.length === 0) {
      listEl.innerHTML = `<p class="empty-note">Rien en attente.</p>`
      return
    }

    listEl.innerHTML = captures
      .map(
        (c) => `
        <div class="fiche-row">
          <div class="tab"></div>
          <div class="fiche-body">
            <div class="fiche-meta" style="margin-bottom: 4px;">${formatDate(c.date_creation)}</div>
            <div style="font-size: 14px;">${c.texte}</div>
          </div>
          <div class="fiche-actions" style="gap: 8px;">
            <button class="btn" data-traitee="${c.id}" style="width: auto;">Traitée</button>
            <button class="btn" data-supprimer="${c.id}" style="width: auto;">Supprimer</button>
          </div>
        </div>
      `
      )
      .join('')

    listEl.querySelectorAll('[data-traitee]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await marquerCaptureTraitee(btn.dataset.traitee)
        loadCaptures()
      })
    })

    listEl.querySelectorAll('[data-supprimer]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await supprimerCapture(btn.dataset.supprimer)
        loadCaptures()
      })
    })
  }

  loadCaptures()
}
