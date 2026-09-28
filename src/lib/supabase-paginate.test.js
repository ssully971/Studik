import { describe, it, expect, vi } from 'vitest'
import { paginerTout, requeteParLots } from './supabase-paginate.js'

// Fausse requête Supabase : un tableau fixe de { id } sur lequel .range(debut, fin) découpe la
// bonne tranche, comme le ferait vraiment PostgREST. `erreurSurPage` simule une page qui échoue
// (page 0 = premier appel de .range()).
function fabriqueFausseRequete(total, { erreurSurPage = null } = {}) {
  const lignes = Array.from({ length: total }, (_, i) => ({ id: i }))
  let appel = 0
  return () => {
    const pageActuelle = appel++
    return {
      range(debut, fin) {
        if (pageActuelle === erreurSurPage) {
          return Promise.resolve({ data: null, error: new Error(`page ${pageActuelle} en échec`) })
        }
        return Promise.resolve({ data: lignes.slice(debut, fin + 1), error: null })
      },
    }
  }
}

describe('paginerTout', () => {
  it.each([0, 1, 999, 1000, 1001, 1999, 2000, 2001])('renvoie exactement %i lignes, sans doublon ni perte', async (total) => {
    const fabrique = fabriqueFausseRequete(total)
    const resultat = await paginerTout(fabrique)
    expect(resultat).toHaveLength(total)
    // Aucun doublon : autant d'ids uniques que de lignes.
    expect(new Set(resultat.map((r) => r.id)).size).toBe(total)
    // Aucun trou : la suite 0..total-1 est intégralement couverte, dans l'ordre.
    expect(resultat.map((r) => r.id)).toEqual(Array.from({ length: total }, (_, i) => i))
  })

  it("s'arrête après la première page reçue non pleine, sans requête superflue", async () => {
    const fabrique = vi.fn(fabriqueFausseRequete(1000))
    await paginerTout(fabrique)
    // Une page de 1000 pile suit d'une page vide (0 ligne < taillePage) qui confirme la fin :
    // deux appels, pas plus.
    expect(fabrique).toHaveBeenCalledTimes(2)
  })

  it('propage une erreur survenant sur une page intermédiaire', async () => {
    const fabrique = fabriqueFausseRequete(2500, { erreurSurPage: 1 })
    await expect(paginerTout(fabrique)).rejects.toThrow('page 1 en échec')
  })

  it('respecte une taille de page personnalisée', async () => {
    const fabrique = fabriqueFausseRequete(250)
    const resultat = await paginerTout(fabrique, { taillePage: 100 })
    expect(resultat).toHaveLength(250)
  })
})

describe('requeteParLots', () => {
  it('renvoie un tableau vide sans appeler fabriqueRequete pour une liste vide', async () => {
    const fabrique = vi.fn()
    const resultat = await requeteParLots([], fabrique)
    expect(resultat).toEqual([])
    expect(fabrique).not.toHaveBeenCalled()
  })

  it('découpe en lots de 200 par défaut et fusionne sans doublon', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => i)
    const fabrique = vi.fn((lot) => Promise.resolve({ data: lot.map((id) => ({ id })), error: null }))
    const resultat = await requeteParLots(ids, fabrique)
    expect(fabrique).toHaveBeenCalledTimes(3) // 200 + 200 + 50
    expect(resultat).toHaveLength(450)
    expect(new Set(resultat.map((r) => r.id)).size).toBe(450)
  })

  it('respecte une taille de lot personnalisée', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => i)
    const fabrique = vi.fn((lot) => Promise.resolve({ data: lot.map((id) => ({ id })), error: null }))
    await requeteParLots(ids, fabrique, { tailleLot: 4 })
    expect(fabrique).toHaveBeenCalledTimes(3) // 4 + 4 + 2
  })

  it("propage une erreur survenant sur n'importe quel lot", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => i)
    const fabrique = vi.fn((lot) =>
      lot[0] === 200 ? Promise.resolve({ data: null, error: new Error('lot en échec') }) : Promise.resolve({ data: lot.map((id) => ({ id })), error: null })
    )
    await expect(requeteParLots(ids, fabrique)).rejects.toThrow('lot en échec')
  })
})
