import { getQuestionById } from '../../lib/edn-content.js'
import { estTableAbsente, htmlMigrationManquante } from '../../lib/externat-schema.js'
import { escapeHtml } from '../../lib/escape.js'
import { richText } from '../../lib/richtext.js'
import { televerserImage } from '../../lib/images.js'
import { supabase } from '../../lib/supabase.js'

// Éditeur de zones ZAP (§5.6) — SEULE exception au "pas de saisie de contenu dans l'UI" (des
// coordonnées de clic ne peuvent pas venir d'un JSON généré par une IA). Fonctionne au doigt
// (événements pointer). Ne gère que les zones "cercle" (obligatoire) ; "rect" n'est pas ajouté
// depuis cet éditeur pour l'instant — voir DECISIONS.md, lot 3.
const RAYON_DEFAUT = 5

let compteurZoneId = 0
function nouvelIdZone() {
  compteurZoneId += 1
  return `z${Date.now()}_${compteurZoneId}`
}

// renderEdnZap est rappelée à chaque navigation vers cette page : un écouteur `resize` posé sur
// `window` sans précaution s'accumulerait à chaque visite (piège connu, voir CLAUDE.md et
// lib/tag-filter.js) — on garde donc la référence du dernier posé pour le retirer avant d'en
// reposer un nouveau.
let dernierEcouteurResize = null

export async function renderEdnZap(container, id) {
  container.innerHTML = `<div class="wrap"><p class="voice">Chargement…</p></div>`

  let question
  try {
    question = await getQuestionById(id)
  } catch (err) {
    if (estTableAbsente(err)) {
      container.innerHTML = `<div class="wrap"><div class="section-head"><h2 class="voice">Éditeur ZAP</h2></div>${htmlMigrationManquante('001')}</div>`
      return
    }
    container.innerHTML = `<div class="wrap"><p class="empty-note">Erreur : ${escapeHtml(err.message)}</p></div>`
    return
  }

  if (question.format !== 'ZAP') {
    container.innerHTML = `<div class="wrap"><p class="empty-note">La question "${escapeHtml(id)}" n'est pas au format ZAP.</p></div>`
    return
  }

  const zones = [...(question.contenu?.zones || [])].map((z) => ({ ...z }))
  let x = question.contenu?.x || 1

  // Le rayon est en % de la LARGEUR (§5.6) : la hauteur visuelle d'une zone doit donc être
  // recalculée selon le ratio largeur/hauteur réellement affiché pour qu'un cercle reste un
  // cercle, jamais une ellipse. Enregistré une seule fois sur `window` pour toute la durée de
  // cette page (jamais à l'intérieur de render(), rappelée à chaque interaction — piège connu
  // des écouteurs posés sur une cible persistante et jamais nettoyés, voir CLAUDE.md).
  function ajusterFormeZones() {
    const img = document.getElementById('zap-edit-image')
    if (!img || !img.clientWidth || !img.clientHeight) return
    const ratio = img.clientWidth / img.clientHeight
    document.querySelectorAll('[data-zone-index]').forEach((el) => {
      const i = parseInt(el.dataset.zoneIndex, 10)
      el.style.height = `${zones[i].r * 2 * ratio}%`
    })
  }
  if (dernierEcouteurResize) window.removeEventListener('resize', dernierEcouteurResize)
  dernierEcouteurResize = ajusterFormeZones
  window.addEventListener('resize', dernierEcouteurResize)

  function render() {
    container.innerHTML = `
      <div class="wrap">
        <div class="section-head">
          <h2 class="voice">Éditeur ZAP</h2>
        </div>

        <p class="cas-situation">${richText(question.enonce)}</p>

        ${
          question.image
            ? `
          <p class="import-hint">Clique/tape sur l'image pour poser une zone. Reclique sur une zone existante pour ajuster son rayon ci-dessous.</p>
          <div class="zap-image-wrap" id="zap-edit-wrap">
            <img src="${escapeHtml(question.image)}" alt="" id="zap-edit-image" />
            ${zones
              .map(
                (z, i) => `<div class="zap-zone zap-zone-neutre" data-zone-index="${i}" style="left:${z.cx}%; top:${z.cy}%; width:${z.r * 2}%; height:${z.r * 2}%;"></div>`
              )
              .join('')}
          </div>
        `
            : `
          <div class="settings-card">
            <h3 class="voice">Image manquante</h3>
            <p class="settings-desc">Téléverse l'image de cette question avant de poser des zones.</p>
            <label class="btn" style="width: auto; cursor: pointer;">
              Choisir une image
              <input type="file" id="zap-image-input" accept="image/*" style="display: none;" />
            </label>
            <span id="zap-image-status" class="import-status"></span>
          </div>
        `
        }

        <div class="settings-card" style="margin-top: 16px;">
          <h3 class="voice">Réglages</h3>
          <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Points que le candidat peut poser (x, 1 à 5)</label>
          <input type="number" id="zap-x-input" class="search-input settings-input" min="1" max="5" value="${x}" style="max-width: 120px;" />
        </div>

        <div class="settings-card" style="margin-top: 16px;">
          <h3 class="voice">Zones (${zones.length})</h3>
          <div id="zap-zones-list">
            ${
              zones.length === 0
                ? `<p class="empty-note">Aucune zone pour l'instant.</p>`
                : zones
                    .map(
                      (z, i) => `
              <div class="fiche-row">
                <div class="tab" style="background: var(--structure);"></div>
                <div class="fiche-body">
                  <div class="fiche-top"><span class="fiche-title voice">Zone ${z.id}</span></div>
                  <div class="fiche-meta">
                    Rayon : <input type="range" min="1" max="25" value="${z.r}" data-rayon-index="${i}" style="vertical-align: middle;" />
                    <span data-rayon-valeur="${i}">${z.r}</span>%
                  </div>
                </div>
                <div class="fiche-actions">
                  <button class="btn" data-supprimer-zone="${i}" style="width: auto;">Supprimer</button>
                </div>
              </div>
            `
                    )
                    .join('')
            }
          </div>
        </div>

        <div class="import-actions" style="margin-top: 16px;">
          <button id="zap-save-btn" class="btn primary" style="width: auto;">Enregistrer</button>
          <span id="zap-save-status" class="import-status"></span>
        </div>
      </div>
    `

    const img = document.getElementById('zap-edit-image')

    if (img) {
      if (img.complete) ajusterFormeZones()
      else img.addEventListener('load', ajusterFormeZones, { once: true })
    }

    img?.addEventListener('pointerup', (e) => {
      const rect = img.getBoundingClientRect()
      const cx = ((e.clientX - rect.left) / rect.width) * 100
      const cy = ((e.clientY - rect.top) / rect.height) * 100
      zones.push({ id: nouvelIdZone(), forme: 'cercle', cx, cy, r: RAYON_DEFAUT })
      render()
    })

    document.querySelectorAll('[data-rayon-index]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.rayonIndex, 10)
        zones[i].r = parseInt(e.target.value, 10)
        document.querySelector(`[data-rayon-valeur="${i}"]`).textContent = zones[i].r
        const zoneEl = document.querySelector(`[data-zone-index="${i}"]`)
        if (zoneEl) zoneEl.style.width = `${zones[i].r * 2}%`
        ajusterFormeZones()
      })
    })

    document.querySelectorAll('[data-supprimer-zone]').forEach((btn) => {
      btn.addEventListener('click', () => {
        zones.splice(parseInt(btn.dataset.supprimerZone, 10), 1)
        render()
      })
    })

    document.getElementById('zap-x-input').addEventListener('change', (e) => {
      x = Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1))
    })

    document.getElementById('zap-image-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const statusEl = document.getElementById('zap-image-status')
      statusEl.textContent = 'Envoi…'
      try {
        const url = await televerserImage(file)
        const { error } = await supabase.from('edn_questions').update({ image: url }).eq('id', question.id)
        if (error) throw error
        question.image = url
        render()
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message
        statusEl.className = 'import-status error'
      }
    })

    document.getElementById('zap-save-btn').addEventListener('click', async () => {
      const statusEl = document.getElementById('zap-save-status')
      statusEl.textContent = 'Enregistrement…'
      statusEl.className = 'import-status'
      try {
        const { error } = await supabase.from('edn_questions').update({ contenu: { ...question.contenu, zones, x } }).eq('id', question.id)
        if (error) throw error
        question.contenu = { ...question.contenu, zones, x }
        statusEl.textContent = 'Enregistré.'
        statusEl.className = 'import-status success'
      } catch (err) {
        statusEl.textContent = 'Erreur : ' + err.message
        statusEl.className = 'import-status error'
      }
    })
  }

  render()
}
