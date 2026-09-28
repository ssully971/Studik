import { describe, it, expect } from 'vitest'
import { correctionTexte, texteBrut, genererLignesCsvAnki, genererCsvAnki } from './edn-export.js'

describe('correctionTexte', () => {
  it('QRU/QRM : liste les propositions vraies/indispensables, jointes par " ; "', () => {
    const q = {
      format: 'QRM',
      contenu: {
        propositions: [
          { texte: 'A', statut: 'vrai' },
          { texte: 'B', statut: 'indispensable' },
          { texte: 'C', statut: 'faux' },
        ],
      },
    }
    expect(correctionTexte(q)).toBe('Bonne(s) réponse(s) : A ; B')
  })

  it('QROC : la première réponse exacte', () => {
    const q = { format: 'QROC', contenu: { exactes: ['hyperkaliémie', 'hyperkaliemie'] } }
    expect(correctionTexte(q)).toBe('Réponse attendue : hyperkaliémie')
  })

  it('TCS : la réponse modale (le plus grand nombre de votes)', () => {
    const q = { format: 'TCS', contenu: { votes: { '-2': 1, '-1': 0, '0': 2, '1': 6, '2': 1 } } }
    expect(correctionTexte(q)).toBe('Réponse modale : Plus probable (+)')
  })

  it('ZAP : message générique (pas de représentation texte des zones)', () => {
    expect(correctionTexte({ format: 'ZAP', contenu: {} })).toContain('zones')
  })

  it("ajoute l'explication à la suite si présente", () => {
    const q = { format: 'QROC', contenu: { exactes: ['X'] }, explication: 'Parce que.' }
    expect(correctionTexte(q)).toBe('Réponse attendue : X — Parce que.')
  })

  it("l'explication seule si aucune correction structurée n'est disponible", () => {
    expect(correctionTexte({ format: 'QROC', contenu: {}, explication: 'Voir cours.' })).toBe('Voir cours.')
  })

  it('chaîne vide si ni correction ni explication (jamais une exception)', () => {
    expect(correctionTexte({ format: 'QROC', contenu: {} })).toBe('')
  })
})

describe('texteBrut', () => {
  it('retire gras/surlignage/important', () => {
    expect(texteBrut('**gras** ==surligné== !!important!!')).toBe('gras surligné important')
  })

  it('remplace une image par un jeton neutre', () => {
    expect(texteBrut('Voir [[img:x.png]] ci-dessous')).toBe('Voir [image] ci-dessous')
  })

  it('aplati les sauts de ligne en espaces', () => {
    expect(texteBrut('Ligne 1\nLigne 2\n\nLigne 3')).toBe('Ligne 1 Ligne 2 Ligne 3')
  })
})

describe('genererLignesCsvAnki / genererCsvAnki', () => {
  it('recto = énoncé, verso = correction, séparés par une virgule', () => {
    const lignes = genererLignesCsvAnki([{ enonce: 'Question ?', format: 'QROC', contenu: { exactes: ['Réponse'] } }])
    expect(lignes).toEqual(['Question ?,Réponse attendue : Réponse'])
  })

  it('échappe un champ contenant une virgule ou un guillemet (RFC4180)', () => {
    const lignes = genererLignesCsvAnki([{ enonce: 'A, B "test"', format: 'QROC', contenu: { exactes: ['X'] } }])
    expect(lignes[0]).toContain('"A, B ""test"""')
  })

  it('genererCsvAnki joint les lignes par des retours à la ligne', () => {
    const csv = genererCsvAnki([
      { enonce: 'Q1', format: 'QROC', contenu: { exactes: ['R1'] } },
      { enonce: 'Q2', format: 'QROC', contenu: { exactes: ['R2'] } },
    ])
    expect(csv.split('\n')).toHaveLength(2)
  })
})
