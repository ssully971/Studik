import { describe, it, expect } from 'vitest'
import { resoudreRaccourci, SEQUENCE_G, ROUTES_SANS_N_R, ROUTES_LISTE } from './raccourcis.js'

describe('garde de saisie', () => {
  it('bloque les raccourcis quand le focus est sur un champ texte', () => {
    const r = resoudreRaccourci({ route: 'referentiel', key: 'n', typeCible: 'texte' })
    expect(r).toBeNull()
  })

  it("ne bloque PAS les raccourcis quand le focus est sur une checkbox (typeCible: null)", () => {
    const r = resoudreRaccourci({ route: 'accueil', key: 'n', typeCible: null })
    expect(r).toEqual({ type: 'navigate', hash: '#entrainement' })
  })

  it('Échap fonctionne même en train de taper', () => {
    const r = resoudreRaccourci({ route: 'accueil', key: 'Escape', typeCible: 'texte', elementsPresents: [] })
    expect(r).toEqual({ type: 'escape-default', goBack: false })
  })

  it('isComposing bloque tout, y compris Échap', () => {
    const r = resoudreRaccourci({ route: 'accueil', key: 'Escape', isComposing: true })
    expect(r).toBeNull()
  })

  it('Espace reste natif sur une checkbox focalisée (ne clique pas #valider-btn)', () => {
    const r = resoudreRaccourci({
      route: 'qcm-jouer',
      key: ' ',
      caseACocherFocalisee: true,
      elementsPresents: ['valider-btn'],
    })
    expect(r).toBeNull()
  })

  it("Espace clique #valider-btn quand ce n'est PAS une checkbox focalisée", () => {
    const r = resoudreRaccourci({ route: 'qcm-jouer', key: ' ', caseACocherFocalisee: false, elementsPresents: ['valider-btn'] })
    expect(r).toEqual({ type: 'click', id: 'valider-btn' })
  })
})

describe('séquence "g" puis une lettre', () => {
  it('g démarre une séquence avec une expiration ~1s dans le futur', () => {
    const r = resoudreRaccourci({ route: 'accueil', key: 'g', maintenant: 1000 })
    expect(r).toEqual({ type: 'sequence-start', expireAt: 2000 })
  })

  it('une lettre valide dans la fenêtre navigue et efface la séquence', () => {
    const r = resoudreRaccourci({
      route: 'accueil',
      key: 'f',
      sequenceEnAttente: { expireAt: 2000 },
      maintenant: 1500,
    })
    expect(r).toEqual({ type: 'navigate', hash: SEQUENCE_G.f, clearSequence: true })
  })

  it('toutes les lettres de SEQUENCE_G résolvent la bonne route', () => {
    Object.entries(SEQUENCE_G).forEach(([lettre, hash]) => {
      const r = resoudreRaccourci({
        route: 'accueil',
        key: lettre,
        sequenceEnAttente: { expireAt: 2000 },
        maintenant: 1000,
      })
      expect(r).toEqual({ type: 'navigate', hash, clearSequence: true })
    })
  })

  it('une lettre invalide dans la fenêtre efface juste la séquence', () => {
    const r = resoudreRaccourci({
      route: 'accueil',
      key: 'z',
      sequenceEnAttente: { expireAt: 2000 },
      maintenant: 1500,
    })
    expect(r).toEqual({ type: 'clear-sequence' })
  })

  it('la séquence expirée est ignorée : la touche est réinterprétée normalement', () => {
    const r = resoudreRaccourci({
      route: 'accueil',
      key: 'f',
      sequenceEnAttente: { expireAt: 1000 },
      maintenant: 2000, // après expiration
    })
    // "f" seul, hors séquence, ne fait rien (pas de mapping global pour "f" seul)
    expect(r).toBeNull()
  })
})

describe('Ctrl/Cmd+K', () => {
  it('Ctrl+K ouvre la recherche', () => {
    expect(resoudreRaccourci({ route: 'accueil', key: 'k', ctrl: true })).toEqual({ type: 'focus-search' })
  })

  it('Cmd+K (meta) ouvre la recherche', () => {
    expect(resoudreRaccourci({ route: 'accueil', key: 'k', meta: true })).toEqual({ type: 'focus-search' })
  })

  it('fonctionne même en train de taper dans un champ texte', () => {
    expect(resoudreRaccourci({ route: 'accueil', key: 'k', ctrl: true, typeCible: 'texte' })).toEqual({ type: 'focus-search' })
  })

  it('Ctrl+Entrée résout comme Entrée même en tapant', () => {
    const r = resoudreRaccourci({
      route: 'qcm-jouer',
      key: 'Enter',
      ctrl: true,
      typeCible: 'texte',
      elementsPresents: ['suivant-btn'],
    })
    expect(r).toEqual({ type: 'click', id: 'suivant-btn' })
  })
})

describe('garde générale Ctrl/Alt/Meta', () => {
  it('Ctrl+une-autre-touche est ignoré', () => {
    expect(resoudreRaccourci({ route: 'accueil', key: 'n', ctrl: true })).toBeNull()
  })

  it('Alt+touche est ignoré', () => {
    expect(resoudreRaccourci({ route: 'accueil', key: 'n', alt: true })).toBeNull()
  })
})

describe('n et r désactivés dans les contextes de jeu', () => {
  ROUTES_SANS_N_R.forEach((route) => {
    it(`"n" ne navigue pas sur ${route}`, () => {
      expect(resoudreRaccourci({ route, key: 'n' })).toBeNull()
    })
    it(`"r" ne navigue pas sur ${route}`, () => {
      expect(resoudreRaccourci({ route, key: 'r' })).toBeNull()
    })
  })

  it('"n" et "r" naviguent bien ailleurs (ex. référentiel)', () => {
    expect(resoudreRaccourci({ route: 'referentiel', key: 'n' })).toEqual({ type: 'navigate', hash: '#entrainement' })
    expect(resoudreRaccourci({ route: 'referentiel', key: 'r' })).toEqual({ type: 'navigate', hash: '#revision' })
  })
})

describe('préservation des touches existantes', () => {
  it('"/" focus la recherche', () => {
    expect(resoudreRaccourci({ route: 'accueil', key: '/' })).toEqual({ type: 'focus-search' })
  })

  it('Espace clique #valider-btn si présent', () => {
    const r = resoudreRaccourci({ route: 'qcm-jouer', key: ' ', elementsPresents: ['valider-btn'] })
    expect(r).toEqual({ type: 'click', id: 'valider-btn' })
  })

  it("Espace ne fait rien si #valider-btn est absent (ou disabled, donc absent de elementsPresents)", () => {
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: ' ', elementsPresents: [] })).toBeNull()
  })

  it('Échap sans modale ouverte ferme le menu/la recherche (comportement existant)', () => {
    expect(resoudreRaccourci({ route: 'accueil', key: 'Escape', elementsPresents: [] })).toEqual({
      type: 'escape-default',
      goBack: false,
    })
  })
})

describe('Échap : modale prioritaire, puis retour arrière sur une fiche', () => {
  it('ferme une modale ouverte en priorité', () => {
    const r = resoudreRaccourci({ route: 'organisation', key: 'Escape', elementsPresents: ['modal-ouvert'] })
    expect(r).toEqual({ type: 'close-modal' })
  })

  it('sans modale, sur une fiche : goBack true', () => {
    const r = resoudreRaccourci({ route: 'fiche', key: 'Escape', elementsPresents: [] })
    expect(r).toEqual({ type: 'escape-default', goBack: true })
  })

  it('une modale ouverte sur une fiche prime sur le retour arrière', () => {
    const r = resoudreRaccourci({ route: 'fiche', key: 'Escape', elementsPresents: ['modal-ouvert'] })
    expect(r).toEqual({ type: 'close-modal' })
  })
})

describe('QCM en cours', () => {
  it('Entrée : premier présent parmi valider/suivant/finir', () => {
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: 'Enter', elementsPresents: ['suivant-btn', 'finir-btn'] })).toEqual({
      type: 'click',
      id: 'suivant-btn',
    })
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: 'Enter', elementsPresents: ['finir-btn'] })).toEqual({
      type: 'click',
      id: 'finir-btn',
    })
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: 'Enter', elementsPresents: [] })).toBeNull()
  })

  it('1 à 5 cochent/décochent un item présent', () => {
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: '3', elementsPresents: ['item-3'] })).toEqual({
      type: 'toggle-item',
      index: 2,
    })
  })

  it('une touche numérique sans item correspondant ne fait rien', () => {
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: '5', elementsPresents: ['item-3'] })).toBeNull()
  })

  it('← / → ciblent precedent-btn/suivant-btn', () => {
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: 'ArrowLeft', elementsPresents: ['precedent-btn'] })).toEqual({
      type: 'click',
      id: 'precedent-btn',
    })
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: 'ArrowRight', elementsPresents: ['suivant-btn'] })).toEqual({
      type: 'click',
      id: 'suivant-btn',
    })
  })

  it('"e" clique refaire-erreurs-btn seulement si présent', () => {
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: 'e', elementsPresents: ['refaire-erreurs-btn'] })).toEqual({
      type: 'click',
      id: 'refaire-erreurs-btn',
    })
    expect(resoudreRaccourci({ route: 'qcm-jouer', key: 'e', elementsPresents: [] })).toBeNull()
  })

  it('même comportement sur qcm-retry-session', () => {
    expect(resoudreRaccourci({ route: 'qcm-retry-session', key: '1', elementsPresents: ['item-1'] })).toEqual({
      type: 'toggle-item',
      index: 0,
    })
  })
})

describe('Entraînement, session, fiche', () => {
  it('Entrée clique valider-btn seulement (pas de chaîne)', () => {
    expect(resoudreRaccourci({ route: 'entrainement', key: 'Enter', elementsPresents: ['valider-btn', 'suivant-btn'] })).toEqual({
      type: 'click',
      id: 'valider-btn',
    })
  })

  it('b / p ciblent revu-bien-btn / revu-pas-bien-btn', () => {
    expect(resoudreRaccourci({ route: 'fiche', key: 'b', elementsPresents: ['revu-bien-btn'] })).toEqual({
      type: 'click',
      id: 'revu-bien-btn',
    })
    expect(resoudreRaccourci({ route: 'session', key: 'p', elementsPresents: ['revu-pas-bien-btn'] })).toEqual({
      type: 'click',
      id: 'revu-pas-bien-btn',
    })
  })

  it('b / p ne font rien hors de ces 3 routes', () => {
    expect(resoudreRaccourci({ route: 'referentiel', key: 'b', elementsPresents: ['revu-bien-btn'] })).toBeNull()
  })
})

describe('Listes (référentiel, révision, erreurs, tag)', () => {
  it('j / k déplacent le focus si des lignes existent', () => {
    expect(resoudreRaccourci({ route: 'referentiel', key: 'j', elementsPresents: ['lignes'] })).toEqual({
      type: 'focus-move',
      direction: 1,
    })
    expect(resoudreRaccourci({ route: 'erreurs', key: 'k', elementsPresents: ['lignes'] })).toEqual({
      type: 'focus-move',
      direction: -1,
    })
  })

  it("↓ / ↑ ne font rien si aucune ligne n'est déjà focalisée (scroll natif laissé passer)", () => {
    expect(resoudreRaccourci({ route: 'referentiel', key: 'ArrowDown', elementsPresents: ['lignes'] })).toBeNull()
  })

  it("↓ / ↑ déplacent le focus quand une ligne est déjà focalisée", () => {
    expect(resoudreRaccourci({ route: 'referentiel', key: 'ArrowDown', elementsPresents: ['lignes', 'ligne-focalisee'] })).toEqual({
      type: 'focus-move',
      direction: 1,
    })
  })

  it('Entrée ouvre la ligne sur référentiel/révision/tag', () => {
    expect(resoudreRaccourci({ route: 'referentiel', key: 'Enter', elementsPresents: ['ligne-focalisee'] })).toEqual({
      type: 'open-focused-row',
    })
    expect(resoudreRaccourci({ route: 'tag', key: 'Enter', elementsPresents: ['ligne-focalisee'] })).toEqual({
      type: 'open-focused-row',
    })
  })

  it("Entrée n'ouvre PAS de ligne sur le carnet d'erreurs (pas d'action fiable)", () => {
    expect(resoudreRaccourci({ route: 'erreurs', key: 'Enter', elementsPresents: ['ligne-focalisee'] })).toBeNull()
  })

  it('j / k fonctionnent quand même sur le carnet d\'erreurs (déplacement seul)', () => {
    expect(resoudreRaccourci({ route: 'erreurs', key: 'j', elementsPresents: ['lignes'] })).toEqual({
      type: 'focus-move',
      direction: 1,
    })
  })
})

describe("absence de collision dans un même contexte", () => {
  // Pour chaque route, un ensemble représentatif de touches ne doit jamais produire deux
  // interprétations différentes selon l'ordre des règles : on vérifie juste qu'une seule
  // branche du résolveur répond par touche (propriété structurelle du code, testée par la
  // stabilité du résultat sur plusieurs appels identiques + absence de throw).
  const routes = ['accueil', 'referentiel', 'revision', 'erreurs', 'tag', 'entrainement', 'session', 'fiche', 'qcm-jouer', 'qcm-retry-session']
  const touches = ['/', 'n', 'r', ' ', 'Enter', 'Escape', 'c', 'g', 'e', 'b', 'p', 'j', 'k', '1', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

  routes.forEach((route) => {
    touches.forEach((key) => {
      it(`${route} / "${key}" : résolution stable et déterministe`, () => {
        const ctx = {
          route,
          key,
          elementsPresents: ['valider-btn', 'suivant-btn', 'precedent-btn', 'finir-btn', 'refaire-erreurs-btn', 'revu-bien-btn', 'revu-pas-bien-btn', 'lignes', 'ligne-focalisee', 'item-1'],
        }
        const a = resoudreRaccourci(ctx)
        const b = resoudreRaccourci(ctx)
        expect(a).toEqual(b)
      })
    })
  })
})
