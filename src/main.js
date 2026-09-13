import './styles/main.css'
import { login, logout, getCurrentUser, onAuthChange } from './lib/auth.js'
import { getPeriodeActuelle, setPeriodeActuelle, getPeriodesDisponibles } from './lib/periode.js'
import { getFiches, texteRechercheFiche } from './lib/fiches.js'
import { getMatieres } from './lib/matieres.js'
import { renderAccueil } from './pages/accueil.js'
import { renderReferentiel } from './pages/referentiel.js'
import { renderImport } from './pages/import.js'
import { renderFicheDetail } from './pages/fiche-detail.js'
import { renderEntrainement } from './pages/entrainement.js'
import { renderParametres } from './pages/parametres.js'
import { renderRevision } from './pages/revision.js'
import { renderCarnetErreurs } from './pages/carnet-erreurs.js'
import { renderCapture } from './pages/capture.js'
import { renderMatieres } from './pages/matieres.js'
import { renderStats } from './pages/stats.js'
import { renderCasListe } from './pages/cas-liste.js'
import { renderQcmListe } from './pages/qcm-liste.js'
import { renderQcmJouer } from './pages/qcm-jouer.js'
import { renderPrompts } from './pages/prompts.js'
import { renderSession } from './pages/session.js'

const app = document.getElementById('app')
const SECONDARY_ROUTES = ['capture', 'import', 'matieres', 'parametres', 'stats', 'cas', 'prompts']

let searchCache = null

function renderLogin() {
  app.innerHTML = `
    <div class="login-screen">
      <form id="login-form" class="login-card">
        <img src="/logo-white.png" alt="Studik" class="mark" />
        <h1 class="voice">Studik</h1>
        <input type="email" id="email" placeholder="Email" required />
        <input type="password" id="password" placeholder="Mot de passe" required />
        <p id="login-error" class="login-error"></p>
        <button type="submit" class="btn primary">Se connecter</button>
      </form>
    </div>
  `

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const errorEl = document.getElementById('login-error')
    errorEl.textContent = ''

    try {
      await login(email, password)
    } catch (err) {
      errorEl.textContent = 'Email ou mot de passe incorrect.'
    }
  })
}

function renderShell(user) {
  app.innerHTML = `
    <header class="topbar">
      <div class="header-row">
        <div class="brand-group">
          <img src="/logo-white.png" alt="Studik" class="mark" />
          <div class="brand voice">Studik</div>
          <select id="periode-select" class="periode-select"></select>
        </div>
        <nav>
          <a href="#accueil" data-route="accueil">Accueil</a>
          <a href="#referentiel" data-route="referentiel">Référentiel</a>
          <a href="#entrainement" data-route="entrainement">Entraînement</a>
          <a href="#qcm" data-route="qcm">QCM</a>
          <a href="#revision" data-route="revision">Révision</a>
          <a href="#erreurs" data-route="erreurs">Erreurs</a>
        </nav>
        <div class="search-wrapper">
          <input type="text" id="global-search-input" class="global-search-input" placeholder="Rechercher partout…" />
          <div id="global-search-results" class="search-results hidden"></div>
        </div>
        <div class="menu-wrapper">
          <button id="menu-toggle" class="nav-btn">Menu ▾</button>
          <div id="menu-dropdown" class="dropdown-panel hidden">
            <a href="#stats" data-route="stats">Statistiques</a>
            <a href="#cas" data-route="cas">Bibliothèque de cas</a>
            <a href="#prompts" data-route="prompts">Prompts d'import</a>
            <a href="#capture" data-route="capture">Capture rapide</a>
            <a href="#import" data-route="import">Importer</a>
            <a href="#matieres" data-route="matieres">Matières</a>
            <a href="#parametres" data-route="parametres">Paramètres</a>
            <div class="dropdown-divider"></div>
            <button id="logout-btn">Se déconnecter</button>
          </div>
        </div>
      </div>
    </header>
    <main id="content"></main>
    <nav class="mobile-tabbar">
      <a href="#accueil" data-route="accueil">Accueil</a>
      <a href="#referentiel" data-route="referentiel">Réf.</a>
      <a href="#entrainement" data-route="entrainement">Cas</a>
      <a href="#revision" data-route="revision">Révision</a>
      <a href="#capture" data-route="capture" class="tabbar-plus">+</a>
    </nav>
  `

  const dropdown = document.getElementById('menu-dropdown')
  const menuToggle = document.getElementById('menu-toggle')

  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('hidden')
  })

  dropdown.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.add('hidden')
  })

  document.addEventListener('click', () => {
    dropdown.classList.add('hidden')
  })

  document.getElementById('logout-btn').addEventListener('click', () => logout())

  setupPeriodeSelector()
  setupGlobalSearch()
  router()
}

async function setupPeriodeSelector() {
  const select = document.getElementById('periode-select')
  let periodes = []
  try {
    periodes = await getPeriodesDisponibles()
  } catch (err) {
    select.style.display = 'none'
    return
  }

  if (periodes.length === 0) {
    select.style.display = 'none'
    return
  }

  const current = getPeriodeActuelle()

  let html = `<option value="">Toutes les périodes</option>`
  periodes.forEach((p) => {
    const label = p.semestre ? `${p.annee} · ${p.semestre}` : p.annee
    const value = JSON.stringify(p)
    const selected = current && current.annee === p.annee && current.semestre === p.semestre ? 'selected' : ''
    html += `<option value='${value}' ${selected}>${label}</option>`
  })

  select.innerHTML = html

  select.addEventListener('change', () => {
    setPeriodeActuelle(select.value ? JSON.parse(select.value) : null)
    router()
  })
}

async function ensureSearchCache() {
  if (searchCache) return searchCache
  const [fiches, matieres] = await Promise.all([getFiches({}), getMatieres({})])
  const periodeParMatiere = {}
  matieres.forEach((m) => {
    periodeParMatiere[m.nom] = m.semestre ? `${m.annee} · ${m.semestre}` : m.annee || ''
  })
  searchCache = { fiches, periodeParMatiere }
  return searchCache
}

function setupGlobalSearch() {
  const input = document.getElementById('global-search-input')
  const results = document.getElementById('global-search-results')

  input.addEventListener('input', async () => {
    const term = input.value.trim().toLowerCase()
    if (!term) {
      results.classList.add('hidden')
      results.innerHTML = ''
      return
    }

    const { fiches, periodeParMatiere } = await ensureSearchCache()
    const matched = fiches.filter((f) => texteRechercheFiche(f).includes(term)).slice(0, 8)

    results.innerHTML = matched.length
      ? matched
          .map((f) => {
            const periode = periodeParMatiere[f.matiere]
            return `
          <a href="#fiche/${f.id}" class="search-result-item type-${f.type}">
            <span class="search-result-title">${f.titre}</span>
            <span class="search-result-meta">${f.matiere}${periode ? ' · ' + periode : ''}</span>
          </a>
        `
          })
          .join('')
      : `<div class="search-result-empty">Aucun résultat</div>`

    results.classList.remove('hidden')
  })

  results.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      results.classList.add('hidden')
      input.value = ''
    }
  })

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.add('hidden')
    }
  })
}

function router() {
  const hash = window.location.hash.replace('#', '') || 'accueil'
  const parts = hash.split('/')
  const route = parts[0]
  const content = document.getElementById('content')

  document.querySelectorAll('nav a, .dropdown-panel a, .mobile-tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === route)
  })

  const menuToggle = document.getElementById('menu-toggle')
  if (menuToggle) {
    menuToggle.classList.toggle('active', SECONDARY_ROUTES.includes(route))
  }

  if (route === 'accueil') {
    renderAccueil(content)
  } else if (route === 'referentiel') {
    renderReferentiel(content)
  } else if (route === 'fiche') {
    renderFicheDetail(content, parts[1])
  } else if (route === 'entrainement') {
    renderEntrainement(content, parts[1])
  } else if (route === 'cas') {
    renderCasListe(content)
  } else if (route === 'qcm') {
    renderQcmListe(content)
  } else if (route === 'qcm-jouer') {
    renderQcmJouer(content, parts[1])
  } else if (route === 'prompts') {
    renderPrompts(content)
  } else if (route === 'revision') {
    renderRevision(content)
  } else if (route === 'session') {
    renderSession(content)
  } else if (route === 'erreurs') {
    renderCarnetErreurs(content)
  } else if (route === 'import') {
    renderImport(content)
  } else if (route === 'capture') {
    renderCapture(content)
  } else if (route === 'matieres') {
    renderMatieres(content)
  } else if (route === 'stats') {
    renderStats(content)
  } else if (route === 'parametres') {
    renderParametres(content)
  } else {
    content.innerHTML = `<div class="wrap"><p class="voice">Page "${route}" à venir.</p></div>`
  }
}

function setupRaccourcisClavier() {
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    const dropdown = document.getElementById('menu-dropdown')
    const searchResults = document.getElementById('global-search-results')

    if (e.key === 'Escape') {
      if (dropdown) dropdown.classList.add('hidden')
      if (searchResults) searchResults.classList.add('hidden')
      if (isTyping) document.activeElement.blur()
      return
    }

    if (isTyping) return

    if (e.key === '/') {
      const search = document.getElementById('search-input') || document.getElementById('global-search-input')
      if (search) {
        e.preventDefault()
        search.focus()
      }
      return
    }

    if (e.key.toLowerCase() === 'n') {
      e.preventDefault()
      window.location.hash = '#entrainement'
      return
    }

    if (e.key.toLowerCase() === 'r') {
      e.preventDefault()
      window.location.hash = '#revision'
      return
    }

    if (e.key === ' ') {
      const validerBtn = document.getElementById('valider-btn')
      if (validerBtn && !validerBtn.disabled) {
        e.preventDefault()
        validerBtn.click()
      }
    }
  })
}

async function init() {
  let currentUserId = undefined

  function handleUser(user) {
    const uid = user?.id ?? null
    if (uid === currentUserId) return
    currentUserId = uid
    if (user) {
      renderShell(user)
    } else {
      renderLogin()
    }
  }

  const user = await getCurrentUser()
  handleUser(user)

  onAuthChange((user) => {
    handleUser(user)
  })

  window.addEventListener('hashchange', router)
  setupRaccourcisClavier()
}

init()
