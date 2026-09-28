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
import { resoudreRaccourci, tableAide } from './lib/raccourcis.js'
import { afficherLoader } from './lib/loader.js'
import {
  getCycle,
  estExternat,
  setCycle,
  onCycleChange,
  synchroniserCycleDepuisServeur,
  getAfficherP2EnExternat,
  onAfficherP2EnExternatChange,
  synchroniserAfficherP2EnExternatDepuisServeur,
} from './lib/cycle.js'
import { renderEdnAccueil } from './pages/externat/edn-accueil.js'
import { renderEdnItems } from './pages/externat/edn-items.js'
import { renderEdnBanque } from './pages/externat/edn-banque.js'
import { renderEdnQuestion } from './pages/externat/edn-question.js'
import { renderEdnDossier } from './pages/externat/edn-dossier.js'
import { renderEdnZap } from './pages/externat/edn-zap.js'
import { renderEcosStations } from './pages/externat/ecos-stations.js'
import { renderEcosStation } from './pages/externat/ecos-station.js'
import { renderEdnSessionResume } from './pages/externat/edn-session.js'
import { renderEdnExamen } from './pages/externat/edn-examen.js'
import { renderEdnStats } from './pages/externat/edn-stats.js'
import { toggleModaleConstantes, fermerModaleConstantes } from './pages/externat/constantes-modal.js'
import { compterTentativesEnAttente, rejouerFileTentatives, EVENEMENT_FILE_CHANGEE } from './lib/offline-queue.js'
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
const SECONDARY_ROUTES = ['capture', 'import', 'parametres', 'stats', 'organisation', 'edn-items', 'edn-stats']

// Routes du mode externat (préfixe #edn-... / #ecos-...) : voir lib/cycle.js et §3 de la spec.
// Une route externat visitée en mode P2 affiche un lien de bascule plutôt qu'une erreur.
const EDN_ROUTE_HANDLERS = {
  'edn-accueil': (content) => renderEdnAccueil(content),
  'edn-items': (content) => renderEdnItems(content),
  'edn-banque': (content) => renderEdnBanque(content),
  'edn-question': (content, id, segment) => renderEdnQuestion(content, id, segment),
  'edn-dossier': (content, id, segment) => renderEdnDossier(content, id, segment),
  'edn-zap': (content, id) => renderEdnZap(content, id),
  'ecos-stations': (content) => renderEcosStations(content),
  'ecos-station': (content, id, segment) => renderEcosStation(content, id, segment),
  'edn-session-resume': (content) => renderEdnSessionResume(content),
  'edn-examen': (content) => renderEdnExamen(content),
  'edn-stats': (content) => renderEdnStats(content),
}

function estRouteExternat(route) {
  return Object.prototype.hasOwnProperty.call(EDN_ROUTE_HANDLERS, route)
}

function renderBasculeExternat(content) {
  content.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">Page réservée au mode Externat</h2>
      </div>
      <p class="empty-note">Cette page n'existe qu'en mode Externat.</p>
      <div class="import-actions">
        <button id="bascule-externat-btn" class="btn primary" style="width: auto;">Passer en mode Externat</button>
      </div>
    </div>
  `
  document.getElementById('bascule-externat-btn').addEventListener('click', () => {
    setCycle('externat')
    router()
  })
}

const NAV_P2 = [
  { hash: '#accueil', route: 'accueil', label: 'Accueil', labelCourt: 'Accueil' },
  { hash: '#referentiel', route: 'referentiel', label: 'Référentiel', labelCourt: 'Réf.' },
  { hash: '#entrainement', route: 'entrainement', label: 'Entraînement', labelCourt: 'Cas' },
  { hash: '#qcm', route: 'qcm', label: 'QCM', labelCourt: null },
  { hash: '#revision', route: 'revision', label: 'Révision', labelCourt: 'Révision' },
  { hash: '#erreurs', route: 'erreurs', label: 'Erreurs', labelCourt: null },
]

// Le Référentiel (contenu P2, fiches) reste accessible en mode Externat par choix explicite
// (§3 : "le Référentiel de fiches reste utile en externat"), mais seulement si Sullivan ne l'a pas
// désactivé (carte "Cycle d'études" de Paramètres) — et toujours étiqueté "(P2)" quand affiché,
// pour ne jamais laisser croire que c'est du contenu Externat natif.
function navExternatEntries() {
  const entries = [
    { hash: '#edn-accueil', route: 'edn-accueil', label: 'Accueil', labelCourt: 'Accueil' },
    { hash: '#edn-banque', route: 'edn-banque', label: 'Banque', labelCourt: 'Banque' },
  ]
  if (getAfficherP2EnExternat()) {
    entries.push({ hash: '#referentiel', route: 'referentiel', label: 'Référentiel (P2)', labelCourt: 'Réf. (P2)' })
  }
  entries.push({ hash: '#erreurs', route: 'erreurs', label: 'Erreurs', labelCourt: 'Erreurs' })
  entries.push({ hash: '#ecos-stations', route: 'ecos-stations', label: 'ECOS', labelCourt: null })
  return entries
}

// Liens vers les pages de l'autre mode, ajoutés dans le menu secondaire pour ne jamais les
// rendre inaccessibles (§3 : "Les pages P2 restent accessibles : le Référentiel de fiches reste
// utile en externat.").
const MENU_CROISE_EXTERNAT = [
  { hash: '#entrainement', label: 'Entraînement (P2)' },
  { hash: '#qcm', label: 'QCM (P2)' },
  { hash: '#revision', label: 'Révision (P2)' },
]

function navDesktopHTML(entries) {
  return entries.map((e) => `<a href="${e.hash}" data-route="${e.route}">${e.label}</a>`).join('')
}

function navTabbarHTML(entries) {
  const principales = entries.slice(0, 4)
  return (
    principales.map((e) => `<a href="${e.hash}" data-route="${e.route}">${e.labelCourt || e.label}</a>`).join('') +
    `<a href="#capture" data-route="capture" class="tabbar-plus">+</a>`
  )
}

function menuDropdownHTML(cycle) {
  const mobileOnlyP2 = `
    <a href="#qcm" data-route="qcm" class="mobile-only-link">QCM</a>
    <a href="#erreurs" data-route="erreurs" class="mobile-only-link">Erreurs</a>
    <div class="dropdown-divider mobile-only-link"></div>
  `
  const mobileOnlyExternat = `
    <a href="#edn-banque" data-route="edn-banque" class="mobile-only-link">Banque</a>
    <a href="#erreurs" data-route="erreurs" class="mobile-only-link">Erreurs</a>
    <div class="dropdown-divider mobile-only-link"></div>
  `
  const croise =
    cycle === 'externat' && getAfficherP2EnExternat()
      ? MENU_CROISE_EXTERNAT.map((e) => `<a href="${e.hash}">${e.label}</a>`).join('') + `<div class="dropdown-divider"></div>`
      : ''

  return `
    ${cycle === 'externat' ? mobileOnlyExternat : mobileOnlyP2}
    <a href="#edn-items" data-route="edn-items">Items R2C</a>
    <div class="dropdown-divider"></div>
    ${croise}
    <a href="${cycle === 'externat' ? '#edn-stats' : '#stats'}" data-route="${cycle === 'externat' ? 'edn-stats' : 'stats'}">Statistiques</a>
    <a href="#capture" data-route="capture">Capture rapide</a>
    <a href="#import" data-route="import">Import &amp; prompts</a>
    <a href="#organisation" data-route="organisation">Organisation</a>
    <a href="#parametres" data-route="parametres">Paramètres</a>
    <div class="dropdown-divider"></div>
    <button id="logout-btn">Se déconnecter</button>
  `
}

// Redessine nav desktop / tabbar mobile / menu déroulant / badge selon le cycle courant, sans
// re-créer toute la coquille (pas de nouveaux écouteurs à reposer : ces liens sont de simples
// <a href> qui déclenchent hashchange, jamais de listener direct dessus).
function appliquerNavPourCycle() {
  const cycle = getCycle()
  const entries = cycle === 'externat' ? navExternatEntries() : NAV_P2

  const navEl = document.querySelector('header nav')
  if (navEl) navEl.innerHTML = navDesktopHTML(entries)

  const tabbarEl = document.querySelector('.mobile-tabbar')
  if (tabbarEl) tabbarEl.innerHTML = navTabbarHTML(entries)

  const dropdown = document.getElementById('menu-dropdown')
  if (dropdown) {
    dropdown.innerHTML = menuDropdownHTML(cycle)
    document.getElementById('logout-btn')?.addEventListener('click', () => logout())
  }

  const badge = document.getElementById('cycle-badge')
  if (badge) badge.textContent = cycle === 'externat' ? 'EXTERNAT' : 'P2'

  const constantesBtn = document.getElementById('constantes-flottant-btn')
  if (constantesBtn) constantesBtn.classList.toggle('hidden', cycle !== 'externat')
  if (cycle !== 'externat') fermerModaleConstantes()

  appliquerVisibilitePeriodeSelect()
  majIndicatifHorsLigne()

  router()
}

// Indicateur discret "hors-ligne · N en attente" (§8 lot 8) — Externat uniquement (le hors-ligne
// ne concerne que le SRS/les tentatives EDN/ECOS, aucune fonctionnalité P2 n'y est liée). Mis à
// jour sur chaque changement de cycle et à chaque évènement online/offline (voir init()).
async function majIndicatifHorsLigne() {
  const indicatif = document.getElementById('hors-ligne-indicatif')
  if (!indicatif) return

  if (!estExternat()) {
    indicatif.classList.add('hidden')
    return
  }

  let enAttente = 0
  try {
    enAttente = await compterTentativesEnAttente()
  } catch {
    enAttente = 0
  }

  const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false
  if (!horsLigne && enAttente === 0) {
    indicatif.classList.add('hidden')
    return
  }

  indicatif.classList.remove('hidden')
  indicatif.textContent = horsLigne ? `Hors ligne · ${enAttente} en attente` : `${enAttente} en attente`
}

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
          <button id="cycle-badge" class="cycle-badge" type="button" title="Cycle d'études — clique pour changer"></button>
          <select id="periode-select" class="periode-select"></select>
          <span id="hors-ligne-indicatif" class="hors-ligne-indicatif hidden"></span>
        </div>
        <nav></nav>
        <div class="search-wrapper" id="search-wrapper">
          <input type="text" id="global-search-input" class="global-search-input" placeholder="Rechercher partout…" />
          <div id="global-search-results" class="search-results hidden"></div>
        </div>
        <div class="menu-wrapper">
          <button id="mobile-search-toggle" class="nav-btn mobile-search-toggle" aria-label="Rechercher">🔍</button>
          <button id="menu-toggle" class="nav-btn">Menu ▾</button>
          <div id="menu-dropdown" class="dropdown-panel hidden"></div>
        </div>
      </div>
    </header>
    <main id="content"></main>
    <nav class="mobile-tabbar"></nav>

    <button id="constantes-flottant-btn" class="constantes-flottant-btn hidden" type="button" title="Constantes biologiques (v)">🧪</button>
    <div id="constantes-modal-overlay" class="modal-overlay hidden">
      <div class="modal-panel">
        <div class="modal-header">
          <span class="voice">Constantes biologiques</span>
          <button id="constantes-modal-close" class="btn" style="width: auto;">Fermer</button>
        </div>
        <div id="constantes-modal-content"></div>
      </div>
    </div>
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

  document.getElementById('cycle-badge').addEventListener('click', () => {
    window.location.hash = '#parametres'
    router()
    requestAnimationFrame(() => document.getElementById('cycle-card')?.scrollIntoView({ block: 'start' }))
  })

  document.getElementById('constantes-flottant-btn').addEventListener('click', () => toggleModaleConstantes())
  document.getElementById('constantes-modal-close').addEventListener('click', () => fermerModaleConstantes())
  document.getElementById('constantes-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'constantes-modal-overlay') fermerModaleConstantes()
  })

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
  appliquerNavPourCycle()
}

// Le sélecteur de période (années/semestres des matières P2) n'a aucun sens en mode Externat, qui
// n'utilise pas la table `matieres` (voir lib/cycle.js) — il doit rester cyclé/masqué même après
// coup si l'utilisateur bascule de cycle, pas seulement à l'ouverture initiale.
let periodesDisponiblesCache = []

function appliquerVisibilitePeriodeSelect() {
  const select = document.getElementById('periode-select')
  if (!select) return
  select.style.display = estExternat() || periodesDisponiblesCache.length === 0 ? 'none' : ''
}

async function setupPeriodeSelector() {
  const select = document.getElementById('periode-select')
  let periodes = []
  try {
    periodes = await getPeriodesDisponibles()
  } catch (err) {
    periodesDisponiblesCache = []
    appliquerVisibilitePeriodeSelect()
    return
  }

  periodesDisponiblesCache = periodes
  if (periodes.length === 0) {
    appliquerVisibilitePeriodeSelect()
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
  appliquerVisibilitePeriodeSelect()

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

// L'accueil "par défaut" (hash vide) dépend du cycle courant (§3 : "L'accueil devient le tableau
// de bord externat"). Sans ce garde, une visite hash-less atterrissait toujours sur l'accueil P2
// même en mode Externat.
function routeAccueilParDefaut() {
  return estExternat() ? 'edn-accueil' : 'accueil'
}

function router() {
  const hash = window.location.hash.replace('#', '') || routeAccueilParDefaut()
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
  } else if (estRouteExternat(route)) {
    if (estExternat()) EDN_ROUTE_HANDLERS[route](content, parts[1], parts[2])
    else renderBasculeExternat(content)
  } else {
    content.innerHTML = `<div class="wrap"><p class="voice">Page "${route}" à venir.</p></div>`
  }
}

// --- Raccourcis clavier ---
// Un seul listener (ci-dessous) qui calcule le contexte courant puis délègue la décision à
// resoudreRaccourci (lib/raccourcis.js, fonction pure et testée). Chaque action retournée agit
// ensuite par .click() sur un élément DOM stable ou par navigation de hash — jamais en
// dupliquant la logique interne d'une page. Voir lib/raccourcis.js pour le détail des touches.

const TYPES_SAISIE = ['text', 'email', 'password', 'search', 'number']
const IDS_BOUTONS_SURVEILLES = ['valider-btn', 'suivant-btn', 'precedent-btn', 'finir-btn', 'refaire-erreurs-btn', 'revu-bien-btn', 'revu-pas-bien-btn', 'import-toggle-btn']

let sequenceRaccourciEnAttente = null
let aideOverlay = null

function estActivable(id) {
  const el = document.getElementById(id)
  return Boolean(el) && !el.disabled
}

function calculerElementsPresents() {
  const presents = IDS_BOUTONS_SURVEILLES.filter(estActivable)

  if (document.querySelector('.modal-overlay:not(.hidden)')) presents.push('modal-ouvert')

  for (let n = 1; n <= 5; n++) {
    const cb = document.querySelector(`#items-group input[data-index="${n - 1}"]`)
    if (cb && !cb.disabled) presents.push(`item-${n}`)
  }

  if (document.querySelectorAll('#content .fiche-row').length > 0) presents.push('lignes')
  if (document.querySelector('#content .fiche-row.kbd-focus')) presents.push('ligne-focalisee')

  return presents
}

function focusRecherche() {
  const search = document.getElementById('search-input') || document.getElementById('global-search-input')
  search?.focus()
}

function echapParDefaut(goBack) {
  document.getElementById('menu-dropdown')?.classList.add('hidden')
  document.getElementById('global-search-results')?.classList.add('hidden')
  document.getElementById('search-wrapper')?.classList.remove('mobile-open')
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur()
  if (goBack) window.history.back()
}

function cocherItem(index) {
  document.querySelector(`#items-group input[data-index="${index}"]`)?.click()
}

function deplacerFocusListe(direction) {
  const lignes = Array.from(document.querySelectorAll('#content .fiche-row'))
  if (lignes.length === 0) return
  const indexActuel = lignes.findIndex((l) => l.classList.contains('kbd-focus'))
  const prochainIndex = indexActuel === -1 ? (direction > 0 ? 0 : lignes.length - 1) : Math.min(lignes.length - 1, Math.max(0, indexActuel + direction))
  if (indexActuel !== -1) lignes[indexActuel].classList.remove('kbd-focus')
  lignes[prochainIndex].classList.add('kbd-focus')
  lignes[prochainIndex].scrollIntoView({ block: 'nearest' })
}

function ouvrirLigneFocalisee() {
  const ligne = document.querySelector('#content .fiche-row.kbd-focus')
  if (!ligne) return
  const cible = ligne.querySelector('[data-open]')
  if (cible) cible.click()
  else ligne.click()
}

function afficherAide() {
  if (!aideOverlay) {
    aideOverlay = document.createElement('div')
    aideOverlay.id = 'aide-clavier-overlay'
    aideOverlay.className = 'modal-overlay hidden'
    aideOverlay.innerHTML = `
      <div class="modal-panel">
        <div class="modal-header">
          <span class="voice">Raccourcis clavier</span>
          <button id="aide-clavier-fermer" class="btn" style="width: auto;">Fermer</button>
        </div>
        <ul class="detail-list">
          ${tableAide()
            .map((r) => `<li><kbd class="kbd-hint">${escapeHtml(r.touches)}</kbd> ${escapeHtml(r.description)}</li>`)
            .join('')}
        </ul>
      </div>
    `
    document.body.appendChild(aideOverlay)
    aideOverlay.addEventListener('click', (e) => {
      if (e.target === aideOverlay) aideOverlay.classList.add('hidden')
    })
    document.getElementById('aide-clavier-fermer').addEventListener('click', () => aideOverlay.classList.add('hidden'))
  }
  aideOverlay.classList.toggle('hidden')
}

function executerRaccourci(action) {
  switch (action.type) {
    case 'navigate':
      // "g h" (SEQUENCE_G, lib/raccourcis.js) cible littéralement '#accueil' — un module pur
      // ignore le cycle courant par conception. Redirigé ici, à la couche qui touche le DOM,
      // vers l'accueil du cycle courant (§3).
      window.location.hash = action.hash === '#accueil' ? `#${routeAccueilParDefaut()}` : action.hash
      break
    case 'click':
      document.getElementById(action.id)?.click()
      break
    case 'focus-search':
      focusRecherche()
      break
    case 'help':
      afficherAide()
      break
    case 'close-modal':
      document.querySelector('.modal-overlay:not(.hidden)')?.classList.add('hidden')
      break
    case 'toggle-constantes':
      // resoudreRaccourci() résout "v" indépendamment du cycle (fonction pure) ; seule cette
      // couche DOM sait qu'il ne doit agir qu'en mode Externat, même principe que
      // routeAccueilParDefaut() ci-dessus pour "g h".
      if (estExternat()) toggleModaleConstantes()
      break
    case 'escape-default':
      echapParDefaut(action.goBack)
      break
    case 'toggle-item':
      cocherItem(action.index)
      break
    case 'focus-move':
      deplacerFocusListe(action.direction)
      break
    case 'open-focused-row':
      ouvrirLigneFocalisee()
      break
    case 'sequence-start':
      sequenceRaccourciEnAttente = { expireAt: action.expireAt }
      break
    case 'clear-sequence':
      sequenceRaccourciEnAttente = null
      break
  }
  if (action.clearSequence) sequenceRaccourciEnAttente = null
}

function setupRaccourcisClavier() {
  document.addEventListener('keydown', (e) => {
    const hash = window.location.hash.replace('#', '') || routeAccueilParDefaut()
    const route = hash.split('/')[0]

    const el = document.activeElement
    const tag = el?.tagName
    const estCaseOuRadio = tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')
    const estChampTexte = tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable || (tag === 'INPUT' && TYPES_SAISIE.includes(el.type))

    const action = resoudreRaccourci({
      route,
      key: e.key,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      alt: e.altKey,
      isComposing: e.isComposing,
      typeCible: estChampTexte ? 'texte' : null,
      caseACocherFocalisee: estCaseOuRadio,
      elementsPresents: calculerElementsPresents(),
      sequenceEnAttente: sequenceRaccourciEnAttente,
      maintenant: Date.now(),
    })

    if (!action) return
    e.preventDefault()
    executerRaccourci(action)
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
      // Rapatrie le fond d'écran / flou / mode verre / cycle d'études depuis le serveur pour
      // qu'ils suivent Sullivan d'un appareil à l'autre — après le premier rendu (déjà peint
      // avec le cache local) pour ne jamais retarder l'affichage initial sur le réseau.
      synchroniserFondDepuisServeur()
      synchroniserGlassDepuisServeur()
      synchroniserCycleDepuisServeur()
      synchroniserAfficherP2EnExternatDepuisServeur()
    } else {
      renderLogin()
    }
  }

  const arreterLoader = afficherLoader(app)
  const user = await getCurrentUser()
  arreterLoader()
  handleUser(user)

  onAuthChange((user) => {
    handleUser(user)
  })

  window.addEventListener('hashchange', router)
  setupRaccourcisClavier()
  onCycleChange(() => appliquerNavPourCycle())
  onAfficherP2EnExternatChange(() => appliquerNavPourCycle())

  // Hors-ligne (§8 lot 8) : au retour du réseau, rejoue la file d'attente (insert idempotent +
  // recalcul SRS) puis rafraîchit l'indicateur ; à la perte du réseau, seulement l'indicateur.
  window.addEventListener('online', async () => {
    try {
      await rejouerFileTentatives()
    } catch (err) {
      console.error('Erreur rejeu file hors-ligne', err)
    }
    majIndicatifHorsLigne()
  })
  window.addEventListener('offline', () => majIndicatifHorsLigne())
  window.addEventListener(EVENEMENT_FILE_CHANGEE, () => majIndicatifHorsLigne())
  majIndicatifHorsLigne()
}

init()
