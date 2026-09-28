// Session de révision externat : enchaîne plusieurs cibles (questions isolées et/ou dossiers,
// §7.2 "Révisions dues aujourd'hui" / "Série Flash") en réutilisant tel quel le joueur de question
// isolée (#edn-question) et le joueur de dossier (#edn-dossier) — jamais de logique de jeu
// dupliquée. État module (comme qcm-retry-session.js) : une file de cibles + un index courant.
let file = []
let indexCourant = 0
let labelSession = ''
let modeSession = 'entrainement'

export function demarrerSessionExternat(cibles, label, mode = 'entrainement') {
  file = cibles
  indexCourant = 0
  labelSession = label || 'Session'
  modeSession = mode
  avancer()
}

function avancer() {
  if (indexCourant >= file.length) {
    window.location.hash = '#edn-session-resume'
    return
  }
  const cible = file[indexCourant].cible
  const [type, id] = cible.split(':')
  const segment = `session-${modeSession}`
  window.location.hash = type === 'd' ? `#edn-dossier/${encodeURIComponent(id)}/${segment}` : `#edn-question/${encodeURIComponent(id)}/${segment}`
}

// Appelée par edn-question.js/edn-dossier.js à la place d'une navigation directe vers #edn-banque
// quand ils sont lancés depuis une session.
export function avancerSessionExternat() {
  indexCourant++
  avancer()
}

// Décode le 3e segment de hash (#edn-question/:id/<segment>) en contexte de jeu : si la question
// est jouée dans une session (mode transmis) ou isolément depuis la banque (mode par défaut
// "entrainement", tag d'erreur obligatoire sur une réponse ratée — §7.4).
export function analyserContexteJeu(segment) {
  if (segment === 'session-flash') return { enSession: true, mode: 'flash' }
  if (segment === 'session-entrainement') return { enSession: true, mode: 'entrainement' }
  return { enSession: false, mode: 'entrainement' }
}

export function renderEdnSessionResume(container) {
  const total = file.length
  container.innerHTML = `
    <div class="wrap">
      <div class="section-head">
        <h2 class="voice">${labelSession} — terminée</h2>
      </div>
      <p class="empty-note">${total} cible${total !== 1 ? 's' : ''} traitée${total !== 1 ? 's' : ''}.</p>
      <div class="import-actions">
        <a href="#edn-accueil" class="btn primary" style="width: auto;">Retour au tableau de bord</a>
        <a href="#edn-banque" class="btn" style="width: auto;">Banque</a>
      </div>
    </div>
  `
  file = []
  indexCourant = 0
}
