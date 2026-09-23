// Raccourcis clavier — un seul listener réel (main.js), qui calcule le contexte courant (route,
// éléments présents/activables, garde de saisie) puis délègue la décision à resoudreRaccourci,
// une fonction pure et testée sans accès DOM. Chaque raccourci agit ensuite par .click() sur un
// élément DOM stable existant (id) ou par navigation de hash — jamais en dupliquant la logique
// interne d'une page.
//
// "Contexte" = premier segment du hash courant (ex. "qcm-jouer" pour #qcm-jouer/xyz).

export const SEQUENCE_G = {
  h: '#accueil',
  f: '#referentiel',
  q: '#qcm',
  e: '#erreurs',
  s: '#session',
  t: '#stats',
  i: '#import',
}

const LIBELLES_SEQUENCE_G = {
  h: 'Accueil',
  f: 'Référentiel',
  q: 'QCM',
  e: 'Erreurs',
  s: 'Session de révision',
  t: 'Statistiques',
  i: 'Import',
}

// "n" et "r" (navigation globale) désactivés ici : en jeu, ils risqueraient de faire quitter une
// question en cours par accident.
export const ROUTES_SANS_N_R = ['qcm-jouer', 'qcm-retry-session', 'session']

// Entrée = premier bouton présent parmi cette chaîne, dans l'ordre.
const CHAINE_ENTREE_QCM = ['valider-btn', 'suivant-btn', 'finir-btn']
const CIBLE_ENTREE_SIMPLE = ['valider-btn']

export const ROUTES_QCM = ['qcm-jouer', 'qcm-retry-session']
export const ROUTES_ENTREE_SIMPLE = ['entrainement', 'session', 'fiche']
export const ROUTES_LISTE = ['referentiel', 'revision', 'erreurs', 'tag']
// "erreurs" (carnet d'erreurs) exclue : ses lignes n'ont pas d'action d'ouverture unique et
// fiable au clic (plusieurs boutons distincts par ligne — voir carnet-erreurs.js), donc Entrée
// n'y ouvre rien plutôt que de deviner.
export const ROUTES_LISTE_OUVRABLES = ['referentiel', 'revision', 'tag']

const DUREE_SEQUENCE_MS = 1000

function premierPresent(elementsPresents, ids) {
  return ids.find((id) => elementsPresents.includes(id)) || null
}

function resoudreEntree(route, elementsPresents) {
  if (ROUTES_QCM.includes(route)) {
    const id = premierPresent(elementsPresents, CHAINE_ENTREE_QCM)
    return id ? { type: 'click', id } : null
  }
  if (ROUTES_ENTREE_SIMPLE.includes(route)) {
    const id = premierPresent(elementsPresents, CIBLE_ENTREE_SIMPLE)
    return id ? { type: 'click', id } : null
  }
  if (ROUTES_LISTE_OUVRABLES.includes(route) && elementsPresents.includes('ligne-focalisee')) {
    return { type: 'open-focused-row' }
  }
  return null
}

// Fonction pure : aucun accès DOM, aucun effet de bord. `elementsPresents` est la liste des ids
// (boutons stables) ou marqueurs synthétiques déjà résolus par l'appelant comme "présents et
// activables" (existe dans le DOM et pas `disabled`) — ex. 'valider-btn', 'item-3',
// 'modal-ouvert', 'lignes', 'ligne-focalisee'. `typeCible` vaut 'texte' quand le focus est sur
// une saisie (textarea/select/contenteditable/input texte-like), sinon null (une checkbox, un
// radio ou un bouton focalisés ne comptent PAS comme une saisie).
export function resoudreRaccourci(ctx) {
  const {
    route,
    key,
    ctrl = false,
    meta = false,
    alt = false,
    isComposing = false,
    typeCible = null,
    caseACocherFocalisee = false,
    elementsPresents = [],
    sequenceEnAttente = null,
    maintenant = Date.now(),
  } = ctx

  if (isComposing) return null

  // Sur une checkbox focalisée, Espace reste natif (toggle la case) plutôt que de déclencher
  // #valider-btn — sinon impossible de juste cocher une case au clavier sans valider derrière.
  if (key === ' ' && caseACocherFocalisee) return null

  const mod = ctrl || meta
  const toucheEntree = key === 'Enter'

  // Ctrl/Cmd+K et Ctrl/Cmd+Entrée sont les deux seules combinaisons actives malgré une saisie en
  // cours ou la garde générale Ctrl/Alt/Meta ci-dessous.
  if (mod && key.toLowerCase() === 'k') return { type: 'focus-search' }
  if (mod && toucheEntree) return resoudreEntree(route, elementsPresents)

  if (key === 'Escape') {
    if (elementsPresents.includes('modal-ouvert')) return { type: 'close-modal' }
    return { type: 'escape-default', goBack: route === 'fiche' }
  }

  if (ctrl || meta || alt) return null

  // Une séquence "g" en attente prime sur tout le reste tant qu'elle n'a pas expiré.
  if (sequenceEnAttente && maintenant <= sequenceEnAttente.expireAt) {
    const hash = SEQUENCE_G[key.toLowerCase()]
    return hash ? { type: 'navigate', hash, clearSequence: true } : { type: 'clear-sequence' }
  }

  if (typeCible === 'texte') return null

  if (key.toLowerCase() === 'g') {
    return { type: 'sequence-start', expireAt: maintenant + DUREE_SEQUENCE_MS }
  }

  if (key === '/') return { type: 'focus-search' }
  if (key === '?') return { type: 'help' }
  if (key.toLowerCase() === 'c') return { type: 'navigate', hash: '#capture' }

  if (key.toLowerCase() === 'n' && !ROUTES_SANS_N_R.includes(route)) return { type: 'navigate', hash: '#entrainement' }
  if (key.toLowerCase() === 'r' && !ROUTES_SANS_N_R.includes(route)) return { type: 'navigate', hash: '#revision' }

  if (key === ' ') {
    const id = premierPresent(elementsPresents, CIBLE_ENTREE_SIMPLE)
    return id ? { type: 'click', id } : null
  }

  if (toucheEntree) return resoudreEntree(route, elementsPresents)

  if (ROUTES_QCM.includes(route)) {
    if (/^[1-5]$/.test(key)) {
      return elementsPresents.includes(`item-${key}`) ? { type: 'toggle-item', index: Number(key) - 1 } : null
    }
    if (key.toLowerCase() === 'e') {
      return elementsPresents.includes('refaire-erreurs-btn') ? { type: 'click', id: 'refaire-erreurs-btn' } : null
    }
  }

  if (ROUTES_QCM.includes(route) || ROUTES_ENTREE_SIMPLE.includes(route)) {
    if (key === 'ArrowLeft') return elementsPresents.includes('precedent-btn') ? { type: 'click', id: 'precedent-btn' } : null
    if (key === 'ArrowRight') return elementsPresents.includes('suivant-btn') ? { type: 'click', id: 'suivant-btn' } : null
  }

  if (ROUTES_ENTREE_SIMPLE.includes(route)) {
    if (key.toLowerCase() === 'b') return elementsPresents.includes('revu-bien-btn') ? { type: 'click', id: 'revu-bien-btn' } : null
    if (key.toLowerCase() === 'p') return elementsPresents.includes('revu-pas-bien-btn') ? { type: 'click', id: 'revu-pas-bien-btn' } : null
  }

  if (ROUTES_LISTE.includes(route)) {
    if (key.toLowerCase() === 'j') return elementsPresents.includes('lignes') ? { type: 'focus-move', direction: 1 } : null
    if (key.toLowerCase() === 'k') return elementsPresents.includes('lignes') ? { type: 'focus-move', direction: -1 } : null
    if (key === 'ArrowDown') return elementsPresents.includes('ligne-focalisee') ? { type: 'focus-move', direction: 1 } : null
    if (key === 'ArrowUp') return elementsPresents.includes('ligne-focalisee') ? { type: 'focus-move', direction: -1 } : null
  }

  return null
}

// Table d'aide affichée par "?" — dérivée des mêmes constantes que le résolveur ci-dessus
// (SEQUENCE_G, ROUTES_SANS_N_R...) pour qu'elle ne puisse pas diverger silencieusement de ce que
// les touches font réellement.
export function tableAide() {
  const sequenceG = Object.entries(SEQUENCE_G).map(([lettre, hash]) => ({
    touches: `g puis ${lettre}`,
    description: `Aller à ${LIBELLES_SEQUENCE_G[lettre]} (${hash})`,
  }))

  return [
    { touches: '/', description: 'Recherche' },
    { touches: 'Ctrl/Cmd + K', description: 'Recherche' },
    { touches: '?', description: 'Cette aide' },
    { touches: 'c', description: 'Capture rapide' },
    { touches: 'n', description: `Entraînement (sauf ${ROUTES_SANS_N_R.join(', ')})` },
    { touches: 'r', description: `Révision (sauf ${ROUTES_SANS_N_R.join(', ')})` },
    ...sequenceG,
    { touches: 'Échap', description: "Ferme une modale ouverte, sinon le menu/la recherche, sinon retour en arrière sur une fiche" },
    { touches: 'Espace', description: 'Valider (si applicable)' },
    { touches: 'Entrée', description: 'Valider / suivant / terminer (QCM), ou ouvrir la ligne sélectionnée (listes)' },
    { touches: '← / →', description: 'Précédent / suivant (si les boutons existent)' },
    { touches: '1–5', description: 'Cocher/décocher une proposition (QCM en cours)' },
    { touches: 'e', description: 'Refaire mes erreurs (résultat de QCM)' },
    { touches: 'b / p', description: "Marquer une fiche « bien vue » / « pas top » (entraînement, session, fiche)" },
    { touches: 'j / k, ↓ / ↑', description: 'Se déplacer dans une liste (référentiel, révision, erreurs, tag)' },
    { touches: 'Entrée', description: 'Ouvrir la ligne sélectionnée (référentiel, révision, tag)' },
  ]
}
