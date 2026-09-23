import './styles/main.css'
import { appliquerTheme } from './lib/theme.js'
import { appliquerFond, synchroniserFondDepuisServeur } from './lib/fond.js'
import { appliquerGlass, synchroniserGlassDepuisServeur } from './lib/glass.js'
import { login, logout, getCurrentUser, onAuthChange } from './lib/auth.js'
import { getPeriodeActuelle, setPeriodeActuelle, getPeriodesDisponibles } from './lib/periode.js'
import { getFiches, texteRechercheFiche } from './lib/fiches.js'
import { getMatieres } from './lib/matieres.js'
import { getAllCas, texteRechercheCas } from './lib/cas.js'
import { getAllQcm, texteRechercheQcm } from './lib/qcm.js'
import { definirTermeRecherche } from './lib/highlight.js'
import { escapeHtml } from './lib/escape.js'
import { renderAccueil } from './pages/accueil.js'
import { renderReferentiel } from './pages/referentiel.js'
import { renderImport } from './pages/import.js'
import { renderFicheDetail } from './pages/fiche-detail.js'
import { renderEntrainement } from './pages/entrainement.js'
import { renderParametres } from './pages/parametres.js'
import { renderRevision } from './pages/revision.js'
import { renderCarnetErreurs } from './pages/carnet-erreurs.js'
import { renderCapture } from './pages/capture.js'
import { renderStats } from './pages/stats.js'
import { renderQcmListe } from './pages/qcm-liste.js'
import { renderQcmJouer } from './pages/qcm-jouer.js'
import { renderQcmDetail } from './pages/qcm-detail.js'
import { renderQcmRetrySession } from './pages/qcm-retry-session.js'
import { renderTagPage } from './pages/tag-page.js'
import { renderSession } from './pages/session.js'
import { renderOrganisation } from './pages/organisation.js'

const app = document.getElementById('app')
const SECONDARY_ROUTES = ['capture', 'import', 'parametres', 'stats', 'organisation']

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
        <div class="search-wrapper" id="search-wrapper">
          <input type="text" id="global-search-input" class="global-search-input" placeholder="Rechercher partout…" />
          <div id="global-search-results" class="search-results hidden"></div>
        </div>
        <div class="menu-wrapper">
          <button id="mobile-search-toggle" class="nav-btn mobile-search-toggle" aria-label="Rechercher">🔍</button>
          <button id="menu-toggle" class="nav-btn">Menu ▾</button>
          <div id="menu-dropdown" class="dropdown-panel hidden">
            <a href="#qcm" data-route="qcm" class="mobile-only-link">QCM</a>
            <a href="#erreurs" data-route="erreurs" class="mobile-only-link">Erreurs</a>
            <div class="dropdown-divider mobile-only-link"></div>
            <a href="#stats" data-route="stats">Statistiques</a>
            <a href="#capture" data-route="capture">Capture rapide</a>
            <a href="#import" data-route="import">Import &amp; prompts</a>
            <a href="#organisation" data-route="organisation">Organisation</a>
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

  const searchWrapper = document.getElementById('search-wrapper')
  document.getElementById('mobile-search-toggle').addEventListener('click', (e) => {
    e.stopPropagation()
    searchWrapper.classList.toggle('mobile-open')
    if (searchWrapper.classList.contains('mobile-open')) {
      document.getElementById('global-search-input').focus()
    }
  })

  searchWrapper.addEventListener('click', (e) => e.stopPropagation())

  document.addEventListener('click', () => {
    searchWrapper.classList.remove('mobile-open')
  })

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
  const [fiches, matieres, cas, qcm] = await Promise.all([getFiches({}), getMatieres({}), getAllCas(), getAllQcm({})])
  const periodeParMatiere = {}
  matieres.forEach((m) => {
    periodeParMatiere[m.nom] = m.semestre ? `${m.annee} · ${m.semestre}` : m.annee || ''
  })
  searchCache = { fiches, cas, qcm, periodeParMatiere }
  return searchCache
}

function extraireApercu(texteRecherche, titre, terme) {
  if (titre.toLowerCase().includes(terme)) return ''

  const index = texteRecherche.indexOf(terme)
  if (index === -1) return ''

  const rayon = 40
  const debut = Math.max(0, index - rayon)
  const fin = Math.min(texteRecherche.length, index + terme.length + rayon)

  let extrait = escapeHtml(texteRecherche.slice(debut, fin))
  if (debut > 0) extrait = '…' + extrait
  if (fin < texteRecherche.length) extrait = extrait + '…'

  const regexTerme = new RegExp(`(${terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return extrait.replace(regexTerme, '<strong>$1</strong>')
}

function setupGlobalSearch() {
  const input = document.getElementById('global-search-input')
  const results = document.getElementById('global-search-results')
  const searchWrapper = document.getElementById('search-wrapper')

  input.addEventListener('input', async () => {
    const term = input.value.trim().toLowerCase()
    if (!term) {
      results.classList.add('hidden')
      results.innerHTML = ''
      return
    }

    const { fiches, cas, qcm, periodeParMatiere } = await ensureSearchCache()

    const resultatsFiches = fiches
      .filter((f) => texteRechercheFiche(f).includes(term))
      .map((f) => {
        const periode = periodeParMatiere[f.matiere]
        return {
          href: `#fiche/${f.id}`,
          typeClass: `type-${f.type}`,
          titre: f.titre,
          meta: `Fiche · ${f.matiere}${periode ? ' · ' + periode : ''}`,
          apercu: extraireApercu(texteRechercheFiche(f), f.titre, term),
        }
      })

    const resultatsCas = cas
      .filter((c) => texteRechercheCas(c).includes(term))
      .map((c) => ({
        href: `#entrainement/${c.id}`,
        typeClass: `type-${c.type}`,
        titre: c.question,
        meta: `Cas · ${c.matiere}`,
        apercu: extraireApercu(texteRechercheCas(c), c.question, term),
      }))

    const resultatsQcm = qcm
      .filter((q) => texteRechercheQcm(q).includes(term))
      .map((q) => ({
        href: `#qcm-detail/${q.id}`,
        typeClass: '',
        titre: q.titre,
        meta: `QCM · ${(q.matieres || []).join(', ') || 'aucune matière'}`,
        apercu: extraireApercu(texteRechercheQcm(q), q.titre, term),
      }))

    const matched = [...resultatsFiches, ...resultatsCas, ...resultatsQcm].slice(0, 8)

    results.innerHTML = matched.length
      ? matched
          .map(
            (r) => `
          <a href="${r.href}" class="search-result-item ${r.typeClass}" data-terme="${escapeHtml(term)}">
            <span class="search-result-title">${escapeHtml(r.titre)}</span>
            <span class="search-result-meta">${escapeHtml(r.meta)}</span>
            ${r.apercu ? `<span class="search-result-apercu">${r.apercu}</span>` : ''}
          </a>
        `
          )
          .join('')
      : `<div class="search-result-empty">Aucun résultat</div>`

    results.classList.remove('hidden')
  })

  results.addEventListener('click', (e) => {
    const link = e.target.closest('a')
    if (link) {
      const terme = link.dataset.terme
      if (terme) definirTermeRecherche(terme)
      results.classList.add('hidden')
      input.value = ''
      if (searchWrapper) searchWrapper.classList.remove('mobile-open')
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

  document.getElementById('menu-dropdown')?.classList.add('hidden')
  document.getElementById('global-search-results')?.classList.add('hidden')
  document.getElementById('search-wrapper')?.classList.remove('mobile-open')

  if (route === 'accueil') {
    renderAccueil(content)
  } else if (route === 'referentiel') {
    renderReferentiel(content)
  } else if (route === 'fiche') {
    renderFicheDetail(content, parts[1])
  } else if (route === 'entrainement') {
    renderEntrainement(content, parts[1])
  } else if (route === 'qcm') {
    renderQcmListe(content)
  } else if (route === 'qcm-jouer') {
    renderQcmJouer(content, parts[1])
  } else if (route === 'qcm-detail') {
    renderQcmDetail(content, parts[1])
  } else if (route === 'qcm-retry-session') {
    renderQcmRetrySession(content)
  } else if (route === 'tag') {
    renderTagPage(content, parts[1])
  } else if (route === 'revision') {
    renderRevision(content)
  } else if (route === 'session') {
    renderSession(content)
  } else if (route === 'erreurs') {
    renderCarnetErreurs(content)
  } else if (route === 'import') {
    renderImport(content, parts[1])
  } else if (route === 'capture') {
    renderCapture(content)
  } else if (route === 'organisation') {
    renderOrganisation(content)
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
      document.getElementById('search-wrapper')?.classList.remove('mobile-open')
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
  appliquerTheme()
  appliquerFond()
  appliquerGlass()
  let currentUserId = undefined

  function handleUser(user) {
    const uid = user?.id ?? null
    if (uid === currentUserId) return
    currentUserId = uid
    if (user) {
      renderShell(user)
      // Rapatrie le fond d'écran / flou / mode verre depuis le serveur pour qu'ils suivent
      // Sullivan d'un appareil à l'autre — après le premier rendu (déjà peint avec le cache
      // local) pour ne jamais retarder l'affichage initial sur le réseau.
      synchroniserFondDepuisServeur()
      synchroniserGlassDepuisServeur()
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
