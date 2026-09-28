// Rendu et interaction des 7 formats de question EDN (§5) — module partagé entre le joueur de
// questions isolées (edn-question.js) et le joueur de dossiers (edn-dossier.js), pour ne jamais
// dupliquer cette logique entre les deux écrans.
import { escapeHtml } from '../../lib/escape.js'
import { richText } from '../../lib/richtext.js'
import { melangerFisherYates } from '../../lib/edn-shuffle.js'
import { compteCommeVrai, zoneToucheeParClic } from '../../lib/edn-scoring.js'

// Ordre mélangé des propositions (§5.1), à calculer une seule fois par affichage de question et
// à conserver tel quel jusqu'à validation (jamais recalculé à chaque re-render).
export function ordonnerPropositions(question) {
  if (!Array.isArray(question.contenu?.propositions)) return []
  return melangerFisherYates(question.contenu.propositions)
}

export function reponseInitiale(format) {
  if (format === 'ZAP') return { clics: [] }
  if (format === 'QROC') return ''
  if (format === 'TCS') return null
  return []
}

const LABELS_TCS = ['Exclue (--)', 'Moins probable (-)', 'Ne change rien (=)', 'Plus probable (+)', 'Confirmée (++)']
const CLES_TCS = ['-2', '-1', '0', '1', '2']

function ligneCheckbox(type, i, p, name) {
  return `
    <label class="checkbox-label qcm-proposition" data-item="${i}" data-texte-filtre="${escapeHtml((p.texte || '').toLowerCase())}">
      <input type="${type}" ${name ? `name="${name}"` : ''} data-index="${i}" data-prop-id="${escapeHtml(p.id)}" />
      <span>${richText(p.texte)}</span>
    </label>
  `
}

export function renderZoneReponse(question, propositions) {
  const c = question.contenu || {}
  switch (question.format) {
    case 'QRU':
      return `<div class="checkbox-group" id="items-group">${propositions.map((p, i) => ligneCheckbox('radio', i, p, 'qru-reponse')).join('')}</div>`
    case 'QRM':
      return `<div class="checkbox-group" id="items-group">${propositions.map((p, i) => ligneCheckbox('checkbox', i, p)).join('')}</div>`
    case 'QRP':
      return `
        <p class="import-hint">Coche exactement ${c.n} proposition${c.n > 1 ? 's' : ''}.</p>
        <div class="checkbox-group" id="items-group">${propositions.map((p, i) => ligneCheckbox('checkbox', i, p)).join('')}</div>
      `
    case 'QRP_LONG':
      return `
        <p class="import-hint">Coche exactement ${c.n} proposition${c.n > 1 ? 's' : ''} parmi la liste ci-dessous (filtrable).</p>
        <input type="text" id="qrp-long-filtre" class="search-input" placeholder="Filtrer la liste…" />
        <div class="checkbox-group" id="items-group">${propositions.map((p, i) => ligneCheckbox('checkbox', i, p)).join('')}</div>
      `
    case 'ZAP':
      return `
        <p class="import-hint">Place ${c.x} point${c.x > 1 ? 's' : ''} sur l'image (reclique sur un point déjà posé pour le retirer).</p>
        <div class="zap-image-wrap" id="zap-image-wrap">
          <img src="${escapeHtml(question.image || '')}" alt="" id="zap-image" />
        </div>
      `
    case 'QROC':
      return `
        <input type="text" id="qroc-input" class="search-input" placeholder="Ta réponse (1 à 5 mots)…" autocomplete="off" />
        <p class="settings-desc" id="qroc-compteur">0 mot</p>
      `
    case 'TCS':
      return `<div class="checkbox-group" id="items-group">${CLES_TCS.map((cle, i) => `
        <label class="checkbox-label qcm-proposition" data-item="${i}">
          <input type="radio" name="tcs-reponse" data-index="${i}" data-vote="${cle}" />
          <span>${escapeHtml(LABELS_TCS[i])}</span>
        </label>
      `).join('')}</div>`
    default:
      return `<p class="empty-note">Format non pris en charge : ${escapeHtml(question.format)}</p>`
  }
}

function afficherMarqueursZap(container, clics) {
  const wrap = container.querySelector('#zap-image-wrap')
  if (!wrap) return
  wrap.querySelectorAll('.zap-marker').forEach((m) => m.remove())
  clics.forEach((c) => {
    const marker = document.createElement('div')
    marker.className = 'zap-marker'
    marker.style.left = `${c.x}%`
    marker.style.top = `${c.y}%`
    wrap.appendChild(marker)
  })
}

// Attache les écouteurs d'interaction et tient `state.reponse` à jour. `state` doit déjà porter
// `reponse` initialisée via reponseInitiale(question.format).
export function attacherInteractions(container, question, state) {
  const format = question.format

  if (format === 'QRU' || format === 'QRM' || format === 'QRP' || format === 'QRP_LONG') {
    const inputs = Array.from(container.querySelectorAll('#items-group input'))
    const n = question.contenu.n

    function appliquerLimiteQrp() {
      if (format !== 'QRP' && format !== 'QRP_LONG') return
      const nCoches = inputs.filter((i) => i.checked).length
      inputs.forEach((i) => {
        i.disabled = !i.checked && nCoches >= n
      })
    }

    inputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (format === 'QRU') {
          state.reponse = [input.dataset.propId]
        } else {
          const idx = state.reponse.indexOf(input.dataset.propId)
          if (input.checked && idx === -1) state.reponse.push(input.dataset.propId)
          if (!input.checked && idx !== -1) state.reponse.splice(idx, 1)
        }
        appliquerLimiteQrp()
      })
    })

    if (format === 'QRP_LONG') {
      container.querySelector('#qrp-long-filtre')?.addEventListener('input', (e) => {
        const terme = e.target.value.trim().toLowerCase()
        container.querySelectorAll('#items-group [data-texte-filtre]').forEach((label) => {
          label.style.display = !terme || label.dataset.texteFiltre.includes(terme) ? '' : 'none'
        })
      })
    }
  } else if (format === 'ZAP') {
    const img = container.querySelector('#zap-image')
    img.addEventListener('pointerup', (e) => {
      const rect = img.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      const SEUIL_PX = 14
      const indexProche = state.reponse.clics.findIndex((c) => {
        const dx = ((c.x - x) / 100) * rect.width
        const dy = ((c.y - y) / 100) * rect.height
        return Math.sqrt(dx * dx + dy * dy) <= SEUIL_PX
      })
      if (indexProche !== -1) {
        state.reponse.clics.splice(indexProche, 1)
      } else if (state.reponse.clics.length < question.contenu.x) {
        state.reponse.clics.push({ x, y })
      }
      state.reponse.dimensionsImage = { largeur: rect.width, hauteur: rect.height }
      afficherMarqueursZap(container, state.reponse.clics)
    })
  } else if (format === 'QROC') {
    const input = container.querySelector('#qroc-input')
    const compteur = container.querySelector('#qroc-compteur')
    input.addEventListener('input', () => {
      state.reponse = input.value
      const mots = input.value.trim() ? input.value.trim().split(/\s+/) : []
      compteur.textContent = `${mots.length} mot${mots.length !== 1 ? 's' : ''}${mots.length > 5 ? ' — 5 max recommandé' : ''}`
    })
  } else if (format === 'TCS') {
    container.querySelectorAll('#items-group input').forEach((input) => {
      input.addEventListener('change', () => {
        state.reponse = input.dataset.vote
      })
    })
  }
}

function desactiverZoneReponse(container, question) {
  const format = question.format
  if (format === 'ZAP') {
    container.querySelector('#zap-image')?.style.setProperty('pointer-events', 'none')
  } else if (format === 'QROC') {
    const input = container.querySelector('#qroc-input')
    if (input) input.disabled = true
  } else {
    container.querySelectorAll('#items-group input').forEach((i) => (i.disabled = true))
    container.querySelector('#qrp-long-filtre')?.remove()
  }
}

// Code couleur (§5.10) : vert = coché juste, rouge = coché faux, neutre (bleu/gris) = vrai non
// coché — classes propres au moteur EDN (edn-prop-*) plutôt que celles de qcm-jouer.js
// (item-explication-*), dont la couleur "manqué" (ocre) ne correspond pas au bleu/gris demandé ici.
function classeCorrection(coche, correcte) {
  if (coche && correcte) return 'edn-prop-ok'
  if (coche && !correcte) return 'edn-prop-wrong'
  if (!coche && correcte) return 'edn-prop-neutre'
  return ''
}

function renderCorrectionPropositions(propositions, reponse) {
  const cochees = new Set(reponse)
  return `
    <ul class="detail-list">
      ${propositions
        .map((p) => {
          const coche = cochees.has(p.id)
          const correcte = compteCommeVrai(p.statut)
          const badge = p.statut === 'indispensable' ? ' (indispensable)' : p.statut === 'inacceptable' ? ' (inacceptable)' : ''
          return `<li class="${classeCorrection(coche, correcte)}"><strong>${richText(p.texte)}</strong>${badge}${p.explication ? ` — ${richText(p.explication)}` : ''}</li>`
        })
        .join('')}
    </ul>
  `
}

function renderCorrectionZap(question, reponse) {
  const dims = reponse.dimensionsImage || { largeur: 100, hauteur: 100 }
  const touchees = new Set()
  ;(reponse.clics || []).forEach((clic) => {
    question.contenu.zones.forEach((zone) => {
      if (zoneToucheeParClic(zone, clic, dims)) touchees.add(zone.id)
    })
  })
  const marqueurs = question.contenu.zones
    .map((z) => {
      if (z.forme !== 'cercle') return ''
      const classe = touchees.has(z.id) ? 'zap-zone-ok' : 'zap-zone-neutre'
      return `<div class="zap-zone ${classe}" style="left:${z.cx}%; top:${z.cy}%; width:${z.r * 2}%; height:${(z.r * 2 * dims.largeur) / dims.hauteur}%;"></div>`
    })
    .join('')
  return `
    <div class="zap-image-wrap">
      <img src="${escapeHtml(question.image || '')}" alt="" />
      ${marqueurs}
    </div>
    <p class="settings-desc">${touchees.size} / ${question.contenu.zones.length} zone(s) correcte(s) touchée(s).</p>
  `
}

function renderCorrectionQroc(question, reponse, score) {
  return `
    <p class="settings-desc">Réponse${(question.contenu.exactes || []).length > 1 ? 's' : ''} attendue(s) : ${(question.contenu.exactes || []).map(escapeHtml).join(', ')}${(question.contenu.acceptables || []).length ? ` (acceptable : ${question.contenu.acceptables.map(escapeHtml).join(', ')})` : ''}</p>
    <p class="settings-desc">Ta réponse : « ${escapeHtml(reponse)} » — ${score} point${score !== 1 ? 's' : ''}.</p>
    <div class="import-actions" id="qroc-ajustement-actions">
      <button class="btn" data-ajustement="juste" style="width: auto;">Ma réponse était juste</button>
      <button class="btn" data-ajustement="acceptable" style="width: auto;">Ma réponse était acceptable</button>
    </div>
  `
}

function renderCorrectionTcs(question, reponse) {
  const votes = question.contenu.votes
  const total = Object.values(votes).reduce((a, b) => a + Number(b), 0) || 1
  return `
    <ul class="detail-list">
      ${CLES_TCS.map((cle, i) => {
        const v = Number(votes[cle] || 0)
        const pct = Math.round((v / total) * 100)
        const classe = cle === reponse ? 'edn-prop-ok' : ''
        return `<li class="${classe}">${escapeHtml(LABELS_TCS[i])} — ${v} vote${v !== 1 ? 's' : ''} (${pct}%)</li>`
      }).join('')}
    </ul>
    ${question.contenu.panel === 'simule' ? `<span class="tag">panel simulé</span>` : ''}
  `
}

// Rend la correction ET désactive la zone de réponse (§5.10 : une fois validée, une question est
// définitivement verrouillée).
export function renderEtVerrouillerCorrection(container, question, propositions, reponse, score) {
  desactiverZoneReponse(container, question)
  const zone = container.querySelector('#correction-zone')
  if (!zone) return
  zone.classList.remove('hidden')

  let contenu = `<p style="font-weight: 600; margin-bottom: 8px;">${score} point${score !== 1 ? 's' : ''} sur cette question</p>`
  if (['QRU', 'QRM', 'QRP', 'QRP_LONG'].includes(question.format)) {
    contenu += renderCorrectionPropositions(propositions, reponse)
  } else if (question.format === 'ZAP') {
    contenu += renderCorrectionZap(question, reponse)
  } else if (question.format === 'QROC') {
    contenu += renderCorrectionQroc(question, reponse, score)
  } else if (question.format === 'TCS') {
    contenu += renderCorrectionTcs(question, reponse)
  }
  if (question.explication) contenu += `<p style="margin-top: 10px;">${richText(question.explication)}</p>`

  zone.innerHTML = contenu
}

// À appeler juste après renderEtVerrouillerCorrection pour une question QROC : branche les
// boutons "Ma réponse était juste/acceptable" (§5.7), qui appellent `onAjustement(ajustement)`.
export function attacherAjustementQroc(container, onAjustement) {
  container.querySelectorAll('#qroc-ajustement-actions [data-ajustement]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onAjustement(btn.dataset.ajustement)
      container.querySelectorAll('#qroc-ajustement-actions [data-ajustement]').forEach((b) => (b.disabled = true))
    })
  })
}
