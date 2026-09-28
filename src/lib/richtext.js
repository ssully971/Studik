import { escapeHtml } from './escape.js'

// Transforme les images [[img:...]] en jetons neutres avant l'échappement HTML (pour que l'URL
// elle-même passe par escapeHtml comme le reste du texte, voir richtext.test.js), à ré-étendre
// une fois le texte échappé et les autres transformations appliquées.
function extraireImages(str) {
  const images = []
  const travail = String(str).replace(/\[\[img:([^\]]+)\]\]/g, (match, url) => {
    const index = images.length
    images.push(url.trim())
    return ` IMG${index} `
  })
  return { travail, images }
}

// Formules KaTeX (§5.11) : $$...$$ (bloc) puis $...$ (inline), extraites en jetons neutres AVANT
// le reste du pipeline — sinon un `|` dans une formule (ex. valeur absolue $|x|$) serait pris pour
// une colonne de tableau, et le contenu LaTeX brut serait échappé/altéré par les autres règles
// (**gras**, etc.) avant même d'atteindre KaTeX. Rendu réel fait par activerKatex() (chargement
// différé de la librairie), jamais ici : richText() reste synchrone.
function extraireFormules(str) {
  const formules = []
  let travail = String(str).replace(/\$\$([^$]+)\$\$/g, (match, tex) => {
    const index = formules.length
    formules.push({ tex: tex.trim(), bloc: true })
    return ` FORMULE${index} `
  })
  travail = travail.replace(/\$([^$\n]+)\$/g, (match, tex) => {
    const index = formules.length
    formules.push({ tex: tex.trim(), bloc: false })
    return ` FORMULE${index} `
  })
  return { travail, formules }
}

function transformerInline(segment, images, formules) {
  let out = escapeHtml(segment)
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/==(.+?)==/g, '<mark class="rt-highlight">$1</mark>')
  out = out.replace(/!!(.+?)!!/g, '<span class="rt-important">$1</span>')
  out = out.replace(/ IMG(\d+) /g, (match, idx) => {
    const url = escapeHtml(images[Number(idx)])
    return `<button type="button" class="img-toggle-btn" data-img-url="${url}">🖼 Afficher l'image</button><span class="img-toggle-content hidden"><img src="${url}" alt="" loading="lazy" /></span>`
  })
  out = out.replace(/ FORMULE(\d+) /g, (match, idx) => {
    const f = formules[Number(idx)]
    const brut = escapeHtml(f.bloc ? `$$${f.tex}$$` : `$${f.tex}$`)
    return `<span class="katex-pending" data-latex="${escapeHtml(f.tex)}" data-bloc="${f.bloc}">${brut}</span>`
  })
  return out
}

// --- Blocs : tableaux et listes (§5.11) ---

function estLigneTableau(ligne) {
  return typeof ligne === 'string' && ligne.includes('|')
}

// Ligne "|---|:---:|---|" (ou sans barres de bord) : uniquement des tirets/deux-points/barres/
// espaces, avec au moins un tiret — sert à repérer la ligne de séparation d'un tableau markdown.
function estLigneSeparateurTableau(ligne) {
  return typeof ligne === 'string' && ligne.includes('-') && /^[\s|:-]+$/.test(ligne)
}

function celluesDeLigne(ligne) {
  let l = ligne.trim()
  if (l.startsWith('|')) l = l.slice(1)
  if (l.endsWith('|')) l = l.slice(0, -1)
  return l.split('|').map((c) => c.trim())
}

// Normalise pour repérer une colonne "normes" quel que soit l'accent/la casse utilisés par le
// prompt (ex. "Normes", "normes", "Norme(s)").
function estColonneNormes(libelle) {
  return (
    libelle
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '') === 'normes'
  )
}

// Les bilans biologiques (§5.11) se présentent en tableau paramètre|valeur|unité|normes. La
// colonne "normes" est masquée par défaut avec un bouton pour la révéler, dès qu'elle est
// détectée par son intitulé — pas besoin qu'une page appelante déclare explicitement qu'elle est
// en mode entraînement : le masquage par défaut est sans risque partout où ce tableau s'affiche
// (voir DECISIONS.md, lot 3).
function rendreTableau(ligneEntete, lignesCorps, images, formules) {
  const entetes = celluesDeLigne(ligneEntete)
  const derniereColonneNormes = entetes.length > 0 && estColonneNormes(entetes[entetes.length - 1])

  const theadHtml = `<tr>${entetes.map((e) => `<th>${transformerInline(e, images, formules)}</th>`).join('')}</tr>`
  const tbodyHtml = lignesCorps
    .map((ligne) => `<tr>${celluesDeLigne(ligne).map((c) => `<td>${transformerInline(c, images, formules)}</td>`).join('')}</tr>`)
    .join('')

  if (!derniereColonneNormes) {
    return `<table class="rt-table"><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>`
  }

  return `
    <button type="button" class="normes-toggle-btn">Afficher les normes</button>
    <table class="rt-table normes-masquees"><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>
  `
}

function estLigneListe(ligne) {
  return typeof ligne === 'string' && /^\s*[-*]\s+/.test(ligne)
}

function rendreListe(lignes, images, formules) {
  const items = lignes.map((l) => l.replace(/^\s*[-*]\s+/, ''))
  return `<ul class="rt-list">${items.map((i) => `<li>${transformerInline(i, images, formules)}</li>`).join('')}</ul>`
}

// Délégation de clic pour les éléments interactifs produits par richText() : l'image repliée
// ([[img:...]]) et le bouton "Afficher les normes" d'un tableau de bilan biologique (§5.11). À
// poser sur un élément recréé à chaque rendu de la page (jamais `document`/`container` persistant
// — voir CLAUDE.md, piège des écouteurs accumulés).
export function activerInteractionsRichText(scopeEl) {
  scopeEl.addEventListener('click', (e) => {
    const imgBtn = e.target.closest('.img-toggle-btn')
    if (imgBtn) {
      imgBtn.nextElementSibling?.classList.toggle('hidden')
      return
    }
    const normesBtn = e.target.closest('.normes-toggle-btn')
    if (normesBtn) {
      const table = normesBtn.nextElementSibling
      const masquees = table?.classList.toggle('normes-masquees')
      normesBtn.textContent = masquees ? 'Afficher les normes' : 'Masquer les normes'
    }
  })
}

export function richText(str) {
  const { travail: sansFormules, formules } = extraireFormules(str)
  const { travail, images } = extraireImages(sansFormules)
  const lignes = travail.split('\n')
  const blocs = []
  let i = 0

  while (i < lignes.length) {
    if (estLigneTableau(lignes[i]) && estLigneSeparateurTableau(lignes[i + 1] || '')) {
      const ligneEntete = lignes[i]
      i += 2
      const corps = []
      while (i < lignes.length && estLigneTableau(lignes[i])) {
        corps.push(lignes[i])
        i++
      }
      blocs.push(rendreTableau(ligneEntete, corps, images, formules))
    } else if (estLigneListe(lignes[i])) {
      const items = []
      while (i < lignes.length && estLigneListe(lignes[i])) {
        items.push(lignes[i])
        i++
      }
      blocs.push(rendreListe(items, images, formules))
    } else {
      blocs.push(transformerInline(lignes[i], images, formules))
      i++
    }
  }

  return blocs.join('\n')
}

// Rendu réel des formules KaTeX détectées par richText() (spans ".katex-pending", voir
// extraireFormules) — chargement différé de katex + sa CSS (await import(...), §5.11), jamais
// dans le bundle principal. À appeler après avoir posé le HTML de richText() dans le DOM (ex.
// juste après activerInteractionsRichText(wrap)) ; no-op immédiat (aucun import déclenché) si le
// texte ne contenait aucune formule.
let katexPromise = null
function chargerKatex() {
  if (!katexPromise) {
    katexPromise = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([mod]) => mod.default ?? mod)
  }
  return katexPromise
}

export async function activerKatex(scopeEl) {
  const spans = scopeEl.querySelectorAll('.katex-pending')
  if (spans.length === 0) return
  const katex = await chargerKatex()
  spans.forEach((span) => {
    try {
      span.innerHTML = katex.renderToString(span.dataset.latex, { throwOnError: false, displayMode: span.dataset.bloc === 'true' })
      span.classList.remove('katex-pending')
    } catch {
      // Formule malformée : on garde le texte brut déjà affiché plutôt que de planter la page.
    }
  })
}
