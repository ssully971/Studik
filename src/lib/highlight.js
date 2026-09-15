const CLE_TERME_RECHERCHE = 'studik_terme_recherche'

export function definirTermeRecherche(terme) {
  try {
    sessionStorage.setItem(CLE_TERME_RECHERCHE, terme)
  } catch {
    // silencieux : le surlignage est un bonus, pas une fonctionnalité critique
  }
}

export function consommerTermeRecherche() {
  try {
    const terme = sessionStorage.getItem(CLE_TERME_RECHERCHE)
    sessionStorage.removeItem(CLE_TERME_RECHERCHE)
    return terme
  } catch {
    return null
  }
}

// Parcourt les noeuds texte sous rootEl et entoure les correspondances de <mark>,
// sans toucher aux balises déjà présentes (gras, surligné, etc.).
export function surlignerDansElement(rootEl, terme) {
  if (!terme) return null
  const termeLower = terme.toLowerCase()

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.toLowerCase().indexOf(termeLower) === -1) return NodeFilter.FILTER_REJECT
      if (node.parentElement && node.parentElement.tagName === 'MARK') return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const noeuds = []
  let n
  while ((n = walker.nextNode())) noeuds.push(n)

  let premierMark = null

  noeuds.forEach((node) => {
    const texte = node.nodeValue
    const texteLower = texte.toLowerCase()
    const fragment = document.createDocumentFragment()
    let curseur = 0
    let index = texteLower.indexOf(termeLower, curseur)

    while (index !== -1) {
      if (index > curseur) fragment.appendChild(document.createTextNode(texte.slice(curseur, index)))
      const mark = document.createElement('mark')
      mark.className = 'search-highlight'
      mark.textContent = texte.slice(index, index + terme.length)
      fragment.appendChild(mark)
      if (!premierMark) premierMark = mark
      curseur = index + terme.length
      index = texteLower.indexOf(termeLower, curseur)
    }
    if (curseur < texte.length) fragment.appendChild(document.createTextNode(texte.slice(curseur)))

    node.parentNode.replaceChild(fragment, node)
  })

  return premierMark
}

export function appliquerSurlignageEnAttente(rootEl) {
  const terme = consommerTermeRecherche()
  if (!terme) return
  const premierMark = surlignerDansElement(rootEl, terme)
  if (premierMark) {
    premierMark.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
