import { getCurrentUser, updatePseudo, updatePassword } from '../lib/auth.js'
import { demanderConfirmation } from '../lib/confirmer.js'
import { getFiches, getAllFichesRaw, insertFiches, deleteAllFiches } from '../lib/fiches.js'
import { getAllCas, insertCas, deleteAllCas, getStatsTentatives, deleteAllTentatives, restaurerTentatives } from '../lib/cas.js'
import { getAllMatieresAvecSousMatieres, insertMatieres, deleteAllMatieres } from '../lib/matieres.js'
import { getAllCaptures, deleteAllCaptures, deleteCapturesTraitees, restaurerCaptures } from '../lib/captures.js'
import {
  getAllQcmRaw,
  insertQcm,
  deleteAllQcm,
  getAllQcmTentativesRaw,
  restaurerTentativesQcm,
  deleteAllTentativesQcm,
} from '../lib/qcm.js'
import { getCheckins, deleteAllCheckins, restaurerCheckins } from '../lib/checkins.js'
import { getTagsAvecPerimetre, restaurerTags } from '../lib/tags.js'
import { getTheme, setTheme } from '../lib/theme.js'
import {
  getFond,
  setFond,
  getReglagesBruts,
  resoudreReglages,
  getParAppareil,
  setParAppareil,
  setMode,
  setFocal,
  setAssombrissement,
  setFlou,
  getHistoriqueFonds,
  ajouterAuHistorique,
  retirerDeLHistorique,
  calculerLuminance,
} from '../lib/fond.js'
import { getGlass, setGlass } from '../lib/glass.js'
import { televerserImage, supprimerImage } from '../lib/images.js'
import { synchroniserDonnees } from '../lib/sync.js'
import { escapeHtml } from '../lib/escape.js'

// Insère les matières parents avant leurs enfants (parent_id référence une autre ligne de la
// même table) : un ordre quelconque ferait échouer la contrainte de clé étrangère à la restauration.
function trierMatieresParProfondeur(matieres) {
  const byId = {}
  matieres.forEach((m) => {
    byId[m.id] = m
  })
  function profondeur(m) {
    let p = 0
    let courant = m
    while (courant?.parent_id) {
      p++
      courant = byId[courant.parent_id]
      if (!courant) break
    }
    return p
  }
  return [...matieres].sort((a, b) => profondeur(a) - profondeur(b))
}

function statusHTML(id) {
  return `<span id="${id}" class="import-status"></span>`
}

function setStatus(id, message, type) {
  const el = document.getElementById(id)
  el.textContent = message
  el.className = `import-status ${type}`
}

const CLE_DERNIERE_SAUVEGARDE = 'studik_derniere_sauvegarde'

// Quel profil (commun/mobile/desktop) l'écran Paramètres affiche/modifie en ce moment — état
// d'affichage local à cette page, pas persisté (le profil réellement appliqué à l'écran dépend
// de contexteAppareil(), pas de ce choix d'édition).
let cibleEditionFond = 'commun'

const FOCAL_POINTS = [
  [0, 0], [50, 0], [100, 0],
  [0, 50], [50, 50], [100, 50],
  [0, 100], [50, 100], [100, 100],
]

function formatDerniereSauvegarde(iso) {
  if (!iso) return "Aucune sauvegarde effectuée depuis cet appareil."
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (jours === 0) return "Dernière sauvegarde : aujourd'hui."
  if (jours === 1) return 'Dernière sauvegarde : il y a 1 jour.'
  return `Dernière sauvegarde : il y a ${jours} jours.`
}

export async function renderParametres(container) {
  const user = await getCurrentUser()
  const pseudoActuel = user?.user_metadata?.pseudo || ''

  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Paramètres</h2>
      </div>

      <div class="settings-stack">
        <div class="settings-card">
          <h3 class="voice">Compte</h3>
          <p class="settings-desc">Connecté en tant que ${user?.email || ''}</p>
        </div>

        <div class="settings-card">
          <h3 class="voice">Thème</h3>
          <p class="settings-desc">Le thème sombre reste celui par défaut.</p>
          <div class="import-actions">
            <button id="theme-dark-btn" class="btn${getTheme() === 'dark' ? ' primary' : ''}" style="width: auto;">Sombre</button>
            <button id="theme-light-btn" class="btn${getTheme() === 'light' ? ' primary' : ''}" style="width: auto;">Clair</button>
          </div>
        </div>

        <div class="settings-card">
          <h3 class="voice">Fond d'écran</h3>
          <p class="settings-desc">Une image personnelle derrière l'interface. N'importe quel format convient — choisis comment elle s'affiche ci-dessous une fois mise en ligne.</p>
          <p class="settings-desc">${getFond() ? 'Un fond personnalisé est actif.' : 'Fond uni par défaut (noir ou blanc selon le thème).'}</p>
          <div class="import-actions">
            <label class="btn" style="width: auto; cursor: pointer;">
              Choisir une image
              <input type="file" id="fond-input" accept="image/*" style="display: none;" />
            </label>
            ${getFond() ? `<button id="fond-reset-btn" class="btn" style="width: auto;">Revenir au fond uni</button>` : ''}
            ${statusHTML('fond-status')}
          </div>

          ${
            getFond()
              ? (() => {
                  const reglagesBruts = getReglagesBruts()
                  const parAppareil = reglagesBruts.parAppareil
                  const cible = parAppareil ? cibleEditionFond : 'commun'
                  const r = resoudreReglages({ ...reglagesBruts, parAppareil: cible !== 'commun' }, cible)
                  return `
          <div style="margin-top: 18px;">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 6px;">Affichage du fond d'écran</label>

            <label class="checkbox-label" style="width: auto; margin-bottom: 10px;">
              <input type="checkbox" id="fond-par-appareil-checkbox" ${parAppareil ? 'checked' : ''} />
              <span>Réglages séparés téléphone / ordinateur</span>
            </label>

            ${
              parAppareil
                ? `
            <div class="filters" id="fond-cible-filters" style="margin-bottom: 12px;">
              <button class="filter-btn ${cible === 'commun' ? 'active' : ''}" data-cible="commun">Commun</button>
              <button class="filter-btn ${cible === 'mobile' ? 'active' : ''}" data-cible="mobile">Téléphone</button>
              <button class="filter-btn ${cible === 'desktop' ? 'active' : ''}" data-cible="desktop">Ordinateur</button>
            </div>
            `
                : ''
            }

            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Mode</label>
            <select id="fond-mode-select" class="periode-select" style="width: 100%; margin-bottom: 14px;">
              <option value="cover" ${r.mode === 'cover' ? 'selected' : ''}>Remplir</option>
              <option value="contain" ${r.mode === 'contain' ? 'selected' : ''}>Ajuster (fond noir autour)</option>
              <option value="centre" ${r.mode === 'centre' ? 'selected' : ''}>Centré (taille d'origine)</option>
            </select>

            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Point focal</label>
            <p class="settings-desc" style="margin-top: 0; margin-bottom: 6px;">Utile quand une image paysage est recadrée sur un écran portrait (mode Remplir).</p>
            <div class="fond-focal-grid" id="fond-focal-grid">
              ${FOCAL_POINTS.map(
                ([x, y]) =>
                  `<button type="button" class="fond-focal-point ${x === r.focal.x && y === r.focal.y ? 'actif' : ''}" data-focal-x="${x}" data-focal-y="${y}" aria-label="Point focal ${x},${y}"></button>`
              ).join('')}
            </div>

            <label id="fond-flou-label" style="font-size: 11px; color: var(--text-faint); display: block; margin: 14px 0 4px;">Flou (${r.flou}px${r.flou === 0 ? ' — net' : ''})</label>
            <input type="range" id="fond-flou-input" min="0" max="20" step="1" value="${r.flou}" style="width: 100%;" />

            <label id="fond-assombrissement-label" style="font-size: 11px; color: var(--text-faint); display: block; margin: 14px 0 4px;">Assombrissement (${r.assombrissement}%)</label>
            <input type="range" id="fond-assombrissement-input" min="0" max="100" step="5" value="${r.assombrissement}" style="width: 100%;" />
          </div>
          `
                })()
              : ''
          }

          <div style="margin-top: 14px;">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 4px;">Style de l'interface</label>
            <div class="import-actions" style="margin: 0;">
              <button id="glass-off-btn" class="btn${getGlass() ? '' : ' primary'}" style="width: auto;">Cartes pleines</button>
              <button id="glass-on-btn" class="btn${getGlass() ? ' primary' : ''}" style="width: auto;">Verre dépoli (Liquid Glass)</button>
            </div>
            <p class="settings-desc" style="margin-top: 6px; margin-bottom: 0;">En verre dépoli, les cartes deviennent translucides et laissent voir le fond d'écran à travers elles — plus intéressant avec un fond personnalisé qu'avec le fond uni.</p>
          </div>

          ${
            getHistoriqueFonds().length > 0
              ? `
          <div style="margin-top: 16px;">
            <label style="font-size: 11px; color: var(--text-faint); display: block; margin-bottom: 6px;">Fonds déjà mis en ligne — clique pour réutiliser, ✕ pour supprimer définitivement</label>
            <div class="fond-galerie">
              ${getHistoriqueFonds()
                .map(
                  (f) => `
                <div class="fond-vignette ${f.url === getFond()?.url ? 'actif' : ''}" style="background-image: url('${escapeHtml(f.url)}');" data-fond-choisir="${escapeHtml(f.url)}" data-fond-luminance="${f.luminance ?? 128}">
                  <button type="button" class="fond-vignette-supprimer" data-fond-supprimer="${escapeHtml(f.url)}" title="Supprimer définitivement">✕</button>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
          `
              : ''
          }
        </div>

        <div class="settings-card">
          <h3 class="voice">Pseudo</h3>
          <p class="settings-desc">Utilisé pour la salutation sur l'accueil.</p>
          <input type="text" id="pseudo-input" class="search-input settings-input" value="${pseudoActuel}" placeholder="Ton pseudo" />
          <div class="import-actions">
            <button id="save-pseudo-btn" class="btn primary" style="width: auto;">Enregistrer</button>
            ${statusHTML('pseudo-status')}
          </div>
        </div>

        <div class="settings-card">
          <h3 class="voice">Mot de passe</h3>
          <input type="password" id="password-input" class="search-input settings-input" placeholder="Nouveau mot de passe" />
          <div class="import-actions">
            <button id="save-password-btn" class="btn primary" style="width: auto;">Changer le mot de passe</button>
            ${statusHTML('password-status')}
          </div>
        </div>

        <div class="settings-card">
          <h3 class="voice">Sauvegarde</h3>
          <p class="settings-desc">Exporte toutes tes données (fiches, cas, QCM, matières, tentatives, captures, streak, tags) dans un fichier, y compris le contenu archivé, ou restaure une sauvegarde précédente.</p>
          <p class="settings-desc" id="derniere-sauvegarde-txt">${formatDerniereSauvegarde(localStorage.getItem(CLE_DERNIERE_SAUVEGARDE))}</p>
          <div class="import-actions">
            <button id="export-btn" class="btn" style="width: auto;">Exporter une sauvegarde</button>
            ${statusHTML('export-status')}
          </div>
          <div class="import-actions">
            <label class="btn" style="width: auto; cursor: pointer;">
              Restaurer une sauvegarde
              <input type="file" id="restore-input" accept="application/json" style="display: none;" />
            </label>
            ${statusHTML('restore-status')}
          </div>
        </div>

        <div class="settings-card">
          <h3 class="voice">Tout synchroniser</h3>
          <p class="settings-desc">Scanne les fiches, cas et QCM et crée automatiquement les matières, sous-matières et tags qui leur manquent en référence. Action sûre : uniquement des créations, jamais de suppression.</p>
          <div class="import-actions">
            <button id="synchroniser-btn" class="btn" style="width: auto;">Tout synchroniser</button>
            ${statusHTML('synchroniser-status')}
          </div>
        </div>

        <div class="settings-card">
          <h3 class="voice">Capture rapide</h3>
          <p class="settings-desc">Les notes déjà marquées "traitées" restent en base indéfiniment tant que tu ne les vides pas.</p>
          <div class="import-actions">
            <button id="clear-captures-btn" class="btn" style="width: auto;">Vider les captures traitées</button>
            ${statusHTML('clear-captures-status')}
          </div>
        </div>

        <div class="settings-card settings-danger">
          <h3 class="voice" style="color: #C46A5C;">Zone dangereuse</h3>
          <p class="settings-desc">Supprime toutes les fiches, cas cliniques, QCM, matières, tentatives et captures, ainsi que ton historique de série (streak). Ta liste de tags de référence et ton pseudo sont conservés. Irréversible — pense à exporter une sauvegarde avant.</p>
          <div class="import-actions">
            <button id="reset-everything-btn" class="btn" style="width: auto; color: #C46A5C; border-color: #C46A5C;">Tout réinitialiser</button>
            ${statusHTML('reset-status')}
          </div>
        </div>
      </div>
    </div>
  `

  document.getElementById('theme-dark-btn').addEventListener('click', () => {
    setTheme('dark')
    renderParametres(container)
  })

  document.getElementById('theme-light-btn').addEventListener('click', () => {
    setTheme('light')
    renderParametres(container)
  })

  document.getElementById('fond-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStatus('fond-status', 'Compression et envoi…', '')
    try {
      const url = await televerserImage(file)
      const luminance = await calculerLuminance(url)
      const evincee = ajouterAuHistorique(url, luminance)
      setFond(url, luminance)
      if (evincee) {
        try {
          await supprimerImage(evincee)
        } catch {
          // silencieux : l'image évincée de l'historique devient juste orpheline dans le stockage
        }
      }
      renderParametres(container)
    } catch (err) {
      setStatus('fond-status', 'Erreur : ' + err.message, 'error')
      e.target.value = ''
    }
  })

  const fondResetBtn = document.getElementById('fond-reset-btn')
  if (fondResetBtn) {
    fondResetBtn.addEventListener('click', () => {
      setFond(null)
      renderParametres(container)
    })
  }

  const cibleActuelle = () => (getParAppareil() ? cibleEditionFond : 'commun')

  const fondParAppareilCheckbox = document.getElementById('fond-par-appareil-checkbox')
  if (fondParAppareilCheckbox) {
    fondParAppareilCheckbox.addEventListener('change', (e) => {
      setParAppareil(e.target.checked)
      cibleEditionFond = 'commun'
      renderParametres(container)
    })
  }

  document.getElementById('fond-cible-filters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cible]')
    if (!btn) return
    cibleEditionFond = btn.dataset.cible
    renderParametres(container)
  })

  document.getElementById('fond-mode-select')?.addEventListener('change', (e) => {
    setMode(e.target.value, cibleActuelle())
  })

  document.getElementById('fond-focal-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-focal-x]')
    if (!btn) return
    setFocal({ x: parseInt(btn.dataset.focalX, 10), y: parseInt(btn.dataset.focalY, 10) }, cibleActuelle())
    renderParametres(container)
  })

  const fondFlouInput = document.getElementById('fond-flou-input')
  let flouDebounce = null
  fondFlouInput?.addEventListener('input', (e) => {
    const valeur = parseInt(e.target.value, 10)
    document.getElementById('fond-flou-label').textContent = `Flou (${valeur}px${valeur === 0 ? ' — net' : ''})`
    // filter: blur() en CSS est instantané, mais un léger débounce évite de réécrire le style
    // à chaque pixel de glissement du curseur — cohérence avec le curseur d'assombrissement.
    clearTimeout(flouDebounce)
    flouDebounce = setTimeout(() => setFlou(valeur, cibleActuelle()), 120)
  })

  const fondAssombrissementInput = document.getElementById('fond-assombrissement-input')
  let assombrissementDebounce = null
  fondAssombrissementInput?.addEventListener('input', (e) => {
    const valeur = parseInt(e.target.value, 10)
    document.getElementById('fond-assombrissement-label').textContent = `Assombrissement (${valeur}%)`
    clearTimeout(assombrissementDebounce)
    assombrissementDebounce = setTimeout(() => setAssombrissement(valeur, cibleActuelle()), 120)
  })

  document.getElementById('glass-off-btn').addEventListener('click', () => {
    setGlass(false)
    renderParametres(container)
  })

  document.getElementById('glass-on-btn').addEventListener('click', () => {
    setGlass(true)
    renderParametres(container)
  })

  document.querySelectorAll('[data-fond-choisir]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-fond-supprimer]')) return
      setFond(el.dataset.fondChoisir, parseFloat(el.dataset.fondLuminance))
      renderParametres(container)
    })
  })

  document.querySelectorAll('[data-fond-supprimer]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const url = btn.dataset.fondSupprimer
      if (!(await demanderConfirmation('Supprimer définitivement ce fond d’écran du stockage ? Cette action est irréversible.'))) return
      try {
        await supprimerImage(url)
        retirerDeLHistorique(url)
        if (getFond()?.url === url) setFond(null)
        renderParametres(container)
      } catch (err) {
        setStatus('fond-status', 'Erreur : ' + err.message, 'error')
      }
    })
  })

  document.getElementById('save-pseudo-btn').addEventListener('click', async () => {
    const value = document.getElementById('pseudo-input').value.trim()
    if (!value) {
      setStatus('pseudo-status', "Entre un pseudo avant d'enregistrer.", 'error')
      return
    }
    try {
      await updatePseudo(value)
      setStatus('pseudo-status', 'Enregistré.', 'success')
    } catch (err) {
      setStatus('pseudo-status', 'Erreur : ' + err.message, 'error')
    }
  })

  document.getElementById('save-password-btn').addEventListener('click', async () => {
    const value = document.getElementById('password-input').value
    if (!value || value.length < 6) {
      setStatus('password-status', 'Le mot de passe doit faire au moins 6 caractères.', 'error')
      return
    }
    try {
      await updatePassword(value)
      document.getElementById('password-input').value = ''
      setStatus('password-status', 'Mot de passe changé.', 'success')
    } catch (err) {
      setStatus('password-status', 'Erreur : ' + err.message, 'error')
    }
  })

  document.getElementById('export-btn').addEventListener('click', async () => {
    try {
      const [fiches, cas, qcm, matieres, tentatives, tentativesQcm, captures, checkins, tags] = await Promise.all([
        getAllFichesRaw(),
        getAllCas(),
        getAllQcmRaw(),
        getAllMatieresAvecSousMatieres(),
        getStatsTentatives(),
        getAllQcmTentativesRaw(),
        getAllCaptures(),
        getCheckins(),
        getTagsAvecPerimetre(),
      ])

      const backup = {
        exported_at: new Date().toISOString(),
        fiches,
        cas,
        qcm,
        matieres,
        tentatives,
        tentativesQcm,
        captures,
        checkins,
        tags,
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `studik-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      localStorage.setItem(CLE_DERNIERE_SAUVEGARDE, new Date().toISOString())
      document.getElementById('derniere-sauvegarde-txt').textContent = formatDerniereSauvegarde(
        localStorage.getItem(CLE_DERNIERE_SAUVEGARDE)
      )

      setStatus('export-status', 'Sauvegarde téléchargée.', 'success')
    } catch (err) {
      setStatus('export-status', 'Erreur : ' + err.message, 'error')
    }
  })

  document.getElementById('restore-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (data.matieres?.length) await insertMatieres(trierMatieresParProfondeur(data.matieres))
      if (data.fiches?.length) await insertFiches(data.fiches)
      if (data.cas?.length) await insertCas(data.cas)
      if (data.qcm?.length) await insertQcm(data.qcm)
      if (data.tentatives?.length) await restaurerTentatives(data.tentatives)
      if (data.tentativesQcm?.length) await restaurerTentativesQcm(data.tentativesQcm)
      if (data.captures?.length) await restaurerCaptures(data.captures)
      if (data.checkins?.length) await restaurerCheckins(data.checkins)
      if (data.tags?.length) await restaurerTags(data.tags)

      setStatus('restore-status', 'Sauvegarde restaurée.', 'success')
    } catch (err) {
      setStatus('restore-status', 'Erreur : ' + err.message, 'error')
    }

    e.target.value = ''
  })

  document.getElementById('synchroniser-btn').addEventListener('click', async () => {
    const btn = document.getElementById('synchroniser-btn')
    btn.disabled = true
    setStatus('synchroniser-status', 'Synchronisation en cours…', '')
    try {
      const { matieresCreees, sousMatieresCreees, coursCrees, tagsCrees } = await synchroniserDonnees()
      const rien = matieresCreees.length === 0 && sousMatieresCreees.length === 0 && coursCrees.length === 0 && tagsCrees.length === 0
      if (rien) {
        setStatus('synchroniser-status', 'Tout est déjà synchronisé.', 'success')
      } else {
        setStatus(
          'synchroniser-status',
          `${matieresCreees.length} matière${matieresCreees.length !== 1 ? 's' : ''} créée${matieresCreees.length !== 1 ? 's' : ''}, ${sousMatieresCreees.length} sous-matière${sousMatieresCreees.length !== 1 ? 's' : ''} créée${sousMatieresCreees.length !== 1 ? 's' : ''}, ${coursCrees.length} cours créé${coursCrees.length !== 1 ? 's' : ''}, ${tagsCrees.length} tag${tagsCrees.length !== 1 ? 's' : ''} créé${tagsCrees.length !== 1 ? 's' : ''}.`,
          'success'
        )
      }
    } catch (err) {
      setStatus('synchroniser-status', 'Erreur : ' + err.message, 'error')
    }
    btn.disabled = false
  })

  document.getElementById('clear-captures-btn').addEventListener('click', async () => {
    if (!(await demanderConfirmation('Supprimer définitivement les captures déjà traitées ?'))) return
    try {
      await deleteCapturesTraitees()
      setStatus('clear-captures-status', 'Captures traitées supprimées.', 'success')
    } catch (err) {
      setStatus('clear-captures-status', 'Erreur : ' + err.message, 'error')
    }
  })

  document.getElementById('reset-everything-btn').addEventListener('click', async () => {
    if (
      !(await demanderConfirmation(
        'Ceci va supprimer TOUTES tes données (fiches, cas, QCM, matières, tentatives, captures, streak). Continuer ?'
      ))
    )
      return
    const saisie = window.prompt('Tape SUPPRIMER en majuscules pour confirmer définitivement.')
    if (saisie !== 'SUPPRIMER') {
      setStatus('reset-status', 'Annulé — le mot tapé ne correspond pas.', 'error')
      return
    }

    try {
      await deleteAllTentatives()
      await deleteAllTentativesQcm()
      await deleteAllCas()
      await deleteAllQcm()
      await deleteAllFiches()
      await deleteAllMatieres()
      await deleteAllCaptures()
      await deleteAllCheckins()
      setStatus('reset-status', 'Toutes les données ont été supprimées.', 'success')
    } catch (err) {
      setStatus('reset-status', 'Erreur : ' + err.message, 'error')
    }
  })
}
