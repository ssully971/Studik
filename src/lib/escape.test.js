import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escape.js'

describe('escapeHtml', () => {
  it('échappe &, <, >, ", \'', () => {
    expect(escapeHtml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#39;')
  })

  it('neutralise une balise <script>', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it("neutralise une sortie d'attribut piégée par un guillemet", () => {
    const url = 'x.jpg" onerror="alert(1)'
    const attr = `<img src="${escapeHtml(url)}">`
    expect(attr).not.toContain('onerror="alert(1)"')
    expect(attr).toBe('<img src="x.jpg&quot; onerror=&quot;alert(1)">')
  })

  it("ordre des remplacements : & est échappé en premier, pas de double échappement fautif", () => {
    // Si "&" n'était pas traité en premier, "&lt;" (résultat de l'échappement de "<")
    // serait lui-même ré-échappé en "&amp;lt;". Ici l'entrée contient déjà un "&" littéral.
    expect(escapeHtml('&<')).toBe('&amp;&lt;')
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('laisse un texte normal inchangé', () => {
    expect(escapeHtml('Douleur thoracique — P2 S1')).toBe('Douleur thoracique — P2 S1')
  })
})
