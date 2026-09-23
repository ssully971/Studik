import { describe, it, expect } from 'vitest'
import { resoudreReglages, calculerStyleFond } from './fond.js'

const DEFAUT = { mode: 'cover', focal: { x: 50, y: 50 }, assombrissement: 60, flou: 24 }

describe('resoudreReglages', () => {
  it('sans réglages séparés : renvoie "commun" complété par les défauts', () => {
    const r = resoudreReglages({ parAppareil: false, commun: { mode: 'contain' }, mobile: { mode: 'centre' } }, 'mobile')
    expect(r.mode).toBe('contain') // "mobile" ignoré : parAppareil est false
    expect(r.focal).toEqual(DEFAUT.focal)
  })

  it('réglages séparés actifs, profil mobile personnalisé : fusionne mobile par-dessus commun', () => {
    const r = resoudreReglages(
      { parAppareil: true, commun: { mode: 'cover', flou: 10 }, mobile: { flou: 20 }, desktop: null },
      'mobile'
    )
    expect(r.flou).toBe(20) // vient de "mobile"
    expect(r.mode).toBe('cover') // vient de "commun", pas écrasé
  })

  it('réglages séparés actifs mais profil desktop jamais personnalisé : retombe sur commun', () => {
    const r = resoudreReglages({ parAppareil: true, commun: { mode: 'contain' }, mobile: { mode: 'cover' }, desktop: null }, 'desktop')
    expect(r.mode).toBe('contain')
  })

  it('fusionne le point focal champ par champ (pas un remplacement en bloc)', () => {
    const r = resoudreReglages({ parAppareil: true, commun: { focal: { x: 0, y: 0 } }, mobile: { focal: { y: 100 } } }, 'mobile')
    expect(r.focal).toEqual({ x: 0, y: 100 })
  })

  it("objet vide -> tous les défauts", () => {
    const r = resoudreReglages({}, 'desktop')
    expect(r).toEqual(DEFAUT)
  })
})

describe('calculerStyleFond', () => {
  it('aucune image : pas de background, pas de flou', () => {
    const s = calculerStyleFond({ fondUrl: null, reglages: DEFAUT, inkHex: '#000000' })
    expect(s.backgroundImage).toBe('none')
    expect(s.filter).toBe('none')
  })

  it('mode "cover" -> background-size cover sur les deux calques', () => {
    const s = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: DEFAUT, inkHex: '#000000' })
    expect(s.backgroundSize).toBe('cover, cover')
    expect(s.backgroundColor).toBe('transparent')
  })

  it('mode "contain" -> background-size contain + fond noir OLED pour les bandes', () => {
    const s = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, mode: 'contain' }, inkHex: '#ffffff' })
    expect(s.backgroundSize).toBe('contain, contain')
    expect(s.backgroundColor).toBe('#000000') // pas inkHex : noir OLED fixe, pas la couleur du thème
  })

  it('mode "centre" -> background-size auto (taille d\'origine, pas de mise à l\'échelle)', () => {
    const s = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, mode: 'centre' }, inkHex: '#000000' })
    expect(s.backgroundSize).toBe('auto, auto')
  })

  it('point focal -> background-position en pourcentages sur les deux calques', () => {
    const s = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, focal: { x: 0, y: 100 } }, inkHex: '#000000' })
    expect(s.backgroundPosition).toBe('0% 100%, 0% 100%')
  })

  it('flou à 0 : pas de filter, pas de débord (inset à 0)', () => {
    const s = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, flou: 0 }, inkHex: '#000000' })
    expect(s.filter).toBe('none')
    expect(s.inset).toBe('0px')
  })

  it('flou > 0 : filter: blur() + la couche déborde du double du rayon (inset négatif)', () => {
    const s = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, flou: 10 }, inkHex: '#000000' })
    expect(s.filter).toBe('blur(10px)')
    expect(s.inset).toBe('-20px')
  })

  it('flou négatif ou hors bornes est ramené dans [0, 40]', () => {
    const s1 = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, flou: -5 }, inkHex: '#000000' })
    expect(s1.filter).toBe('none')
    const s2 = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, flou: 999 }, inkHex: '#000000' })
    expect(s2.filter).toBe('blur(40px)')
  })

  it('assombrissement 0% -> voile totalement transparent ; 100% -> voile opaque', () => {
    const s0 = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, assombrissement: 0 }, inkHex: '#000000' })
    expect(s0.backgroundImage).toContain('rgba(0, 0, 0, 0)')
    const s100 = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: { ...DEFAUT, assombrissement: 100 }, inkHex: '#000000' })
    expect(s100.backgroundImage).toContain('rgba(0, 0, 0, 1)')
  })

  it('utilise inkHex pour la couleur du voile (thème clair vs sombre)', () => {
    const sombre = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: DEFAUT, inkHex: '#000000' })
    expect(sombre.backgroundImage).toContain('rgba(0, 0, 0,')
    const clair = calculerStyleFond({ fondUrl: 'https://x/img.jpg', reglages: DEFAUT, inkHex: '#FBFAF7' })
    expect(clair.backgroundImage).toContain('rgba(251, 250, 247,')
  })
})
