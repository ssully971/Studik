import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validerImport, ficheSchema, casSchema, qcmSchema } from './import-schemas.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = join(__dirname, '..', 'data', 'prompts')

function ficheValide(type, extra = {}) {
  const contenu = {
    clinique: { description: 'Un signe.', contexte_recherche: ['Un élément'] },
    mecanisme: { etapes: ['Étape 1'], facteurs_declenchants: [], consequences_physiologiques: [] },
    structure: { localisation: 'Ici.', rapports_anatomiques: [], fonction: 'Sert à ça.' },
  }[type]
  return {
    id: 'fiche-test',
    matiere: 'Sémiologie',
    sous_matiere: null,
    cours: null,
    type,
    titre: 'Titre',
    synonymes: [],
    contenu_structure: contenu,
    tags: [],
    pre_requis: [],
    consequences: [],
    statut: 'valide',
    ...extra,
  }
}

function casValide(type, extra = {}) {
  const gabarit = {
    clinique: 'signes',
    mecanisme: 'evenements',
    structure: 'elements',
  }[type]
  const resultKey = { clinique: 'pathologies', mecanisme: 'consequences', structure: 'identification' }[type]
  return {
    id: 'cas-test',
    type,
    matiere: 'Sémiologie',
    cours: null,
    niveau: 1,
    fiches_liees: [],
    tags: [],
    enonce: { situation: 'Un patient...', elements: ['Élément 1'] },
    question: 'Quels signes ?',
    reponse_attendue: {
      [gabarit]: [{ label: 'Signe A', correct: true }],
      [resultKey]: ['Pathologie A'],
    },
    statut: 'valide',
    ...extra,
  }
}

function qcmValide(extra = {}) {
  return {
    id: 'qcm-test',
    titre: 'Un QCM',
    matieres: ['Sémiologie'],
    cours: null,
    duree_minutes: 30,
    fiches_liees: [],
    tags: [],
    statut: 'valide',
    questions: [
      {
        enonce: 'Question 1',
        items: [
          { texte: 'Item A', correct: true, explication: 'Car A' },
          { texte: 'Item B', correct: false, explication: 'Car B' },
        ],
        explication: 'Explication globale',
      },
    ],
    ...extra,
  }
}

describe('ficheSchema', () => {
  it.each(['clinique', 'mecanisme', 'structure'])('accepte une fiche %s valide (nouveau)', (type) => {
    const r = ficheSchema(true).safeParse(ficheValide(type))
    expect(r.success).toBe(true)
  })

  it('rejette un champ manquant (titre) sur un nouvel élément', () => {
    const item = ficheValide('clinique')
    delete item.titre
    const r = ficheSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('rejette un mauvais type (tags en chaîne au lieu de tableau)', () => {
    const item = ficheValide('clinique', { tags: 'pas-un-tableau' })
    const r = ficheSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('rejette un type inconnu', () => {
    const item = ficheValide('clinique', { type: 'inconnu' })
    const r = ficheSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('rejette un contenu_structure qui ne correspond pas au type (structure sans localisation/fonction)', () => {
    const item = ficheValide('structure', { contenu_structure: { rapports_anatomiques: [] } })
    const r = ficheSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('mise à jour partielle valide : seul id + un champ, le reste absent', () => {
    const r = ficheSchema(false).safeParse({ id: 'fiche-test', statut: 'archive' })
    expect(r.success).toBe(true)
  })
})

describe('casSchema', () => {
  it.each(['clinique', 'mecanisme', 'structure'])('accepte un cas %s valide (nouveau)', (type) => {
    const r = casSchema(true).safeParse(casValide(type))
    expect(r.success).toBe(true)
  })

  it('rejette niveau 4 (hors de 1-3)', () => {
    const item = casValide('clinique', { niveau: 4 })
    const r = casSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('rejette correct en chaîne au lieu de booléen dans reponse_attendue', () => {
    const item = casValide('clinique')
    item.reponse_attendue.signes[0].correct = 'oui'
    const r = casSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('mise à jour partielle valide : seul id + statut', () => {
    const r = casSchema(false).safeParse({ id: 'cas-test', statut: 'brouillon' })
    expect(r.success).toBe(true)
  })
})

describe('qcmSchema', () => {
  it('accepte un QCM valide (nouveau)', () => {
    const r = qcmSchema(true).safeParse(qcmValide())
    expect(r.success).toBe(true)
  })

  it('rejette une question avec un seul item (minimum 2)', () => {
    const item = qcmValide()
    item.questions[0].items = [{ texte: 'Seul item', correct: true }]
    const r = qcmSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('rejette correct en chaîne au lieu de booléen', () => {
    const item = qcmValide()
    item.questions[0].items[0].correct = 'vrai'
    const r = qcmSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('rejette un champ manquant (duree_minutes) sur un nouvel élément', () => {
    const item = qcmValide()
    delete item.duree_minutes
    const r = qcmSchema(true).safeParse(item)
    expect(r.success).toBe(false)
  })

  it('mise à jour partielle valide : seul id + tags', () => {
    const r = qcmSchema(false).safeParse({ id: 'qcm-test', tags: ['x'] })
    expect(r.success).toBe(true)
  })
})

describe('validerImport : message lisible en français', () => {
  it('chemin 1-based et libellé de type pour une erreur profonde (QCM)', () => {
    const item = qcmValide()
    item.questions[0].items[2] = { texte: 'Item C', correct: 'faux' } // 3e item, index 2
    const erreurs = validerImport('qcm', [item], new Set())
    expect(erreurs.some((e) => e === 'QCM n°1 › questions › 1 › items › 3 › correct : booléen attendu')).toBe(true)
  })

  it("lot tout-ou-rien : un seul élément cassé suffit à produire des erreurs pour le lot", () => {
    const bon = qcmValide({ id: 'qcm-bon' })
    const casse = qcmValide({ id: 'qcm-casse' })
    delete casse.titre
    const erreurs = validerImport('qcm', [bon, casse], new Set())
    expect(erreurs.length).toBeGreaterThan(0)
    expect(erreurs.every((e) => e.startsWith('QCM n°2'))).toBe(true)
  })
})

// Extrait les blocs JSON ```...``` des prompts .md et les valide avec les schémas, pour que
// prompts et schémas ne divergent jamais silencieusement l'un de l'autre.
function extraireBlocsJson(nomFichier) {
  const contenu = readFileSync(join(PROMPTS_DIR, nomFichier), 'utf8')
  const blocs = [...contenu.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]))
  return blocs.flat()
}

describe('synchro prompts <-> schémas', () => {
  it('prompt-fiche-clinique.md correspond à ficheSchema', () => {
    const [item] = extraireBlocsJson('prompt-fiche-clinique.md')
    const r = ficheSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-fiche-mecanisme.md correspond à ficheSchema', () => {
    const [item] = extraireBlocsJson('prompt-fiche-mecanisme.md')
    const r = ficheSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('prompt-fiche-structure.md correspond à ficheSchema', () => {
    const [item] = extraireBlocsJson('prompt-fiche-structure.md')
    const r = ficheSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })

  it('les 3 gabarits de prompt-cas.md correspondent à casSchema', () => {
    const items = extraireBlocsJson('prompt-cas.md')
    expect(items.length).toBe(3)
    items.forEach((item) => {
      const r = casSchema(true).safeParse(item)
      expect(r.success, `${item.type} : ${JSON.stringify(r.success ? null : r.error.issues)}`).toBe(true)
    })
  })

  it('prompt-qcm.md correspond à qcmSchema', () => {
    const [item] = extraireBlocsJson('prompt-qcm.md')
    const r = qcmSchema(true).safeParse(item)
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues)).toBe(true)
  })
})
