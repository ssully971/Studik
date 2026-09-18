import { getCurrentUser, updatePseudo, updatePassword } from '../lib/auth.js'
import { getFiches, getAllFichesRaw, insertFiches, deleteAllFiches } from '../lib/fiches.js'
import { getAllCas, insertCas, deleteAllCas, getStatsTentatives, deleteAllTentatives, restaurerTentatives } from '../lib/cas.js'
import { getMatieres, insertMatieres, deleteAllMatieres } from '../lib/matieres.js'
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
import { getTags, restaurerTags } from '../lib/tags.js'
import { getTheme, setTheme } from '../lib/theme.js'

function statusHTML(id) {
  return `<span id="${id}" class="import-status"></span>`
}

function setStatus(id, message, type) {
  const el = document.getElementById(id)
  el.textContent = message
  el.className = `import-status ${type}`
}

const CLE_DERNIERE_SAUVEGARDE = 'studik_derniere_sauvegarde'

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
        getMatieres({}),
        getStatsTentatives(),
        getAllQcmTentativesRaw(),
        getAllCaptures(),
        getCheckins(),
        getTags(),
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

      if (data.matieres?.length) await insertMatieres(data.matieres)
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

  document.getElementById('clear-captures-btn').addEventListener('click', async () => {
    if (!window.confirm('Supprimer définitivement les captures déjà traitées ?')) return
    try {
      await deleteCapturesTraitees()
      setStatus('clear-captures-status', 'Captures traitées supprimées.', 'success')
    } catch (err) {
      setStatus('clear-captures-status', 'Erreur : ' + err.message, 'error')
    }
  })

  document.getElementById('reset-everything-btn').addEventListener('click', async () => {
    if (
      !window.confirm(
        'Ceci va supprimer TOUTES tes données (fiches, cas, QCM, matières, tentatives, captures, streak). Continuer ?'
      )
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
