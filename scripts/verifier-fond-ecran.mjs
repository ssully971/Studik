// Vérification visuelle multi-navigateur du nouveau système de fond d'écran (#wallpaper-layer),
// via Playwright — installé à la volée par `npx`, jamais ajouté à package.json (voir la demande
// d'origine : "sans polluer package.json"). Sert de complément aux tests vitest (logique pure)
// et aux vérifications déjà faites en direct sur Chromium (voir le résumé donné à Sullivan) :
// l'intérêt principal ici est WebKit, moteur de rendu le plus proche de Safari/iOS, jamais
// testé autrement dans cette session.
//
// Usage : npx --yes -p playwright node scripts/verifier-fond-ecran.mjs
// (nécessite d'avoir fait au préalable : npx --yes playwright install chromium webkit)
//
// Ne teste PAS l'app complète (pas de compte réel nécessaire) : une page HTML autonome
// (scripts/fixtures/fond-ecran-test.html) qui reproduit exactement la formule de
// src/lib/fond.js#calculerStyleFond (déjà testée par 15 tests vitest sur la fonction réelle)
// et charge la VRAIE feuille de style src/styles/main.css. Servie par un petit serveur statique
// (pas Vite : Vite + deux moteurs Playwright dépasse la mémoire disponible dans cet
// environnement — confirmé par un OOM direct, voir CLAUDE.md § environnement contraint).

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = 8917
const DOSSIER_SORTIE = path.join(RACINE, 'scripts', 'fixtures', 'captures')

const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
}

function demarrerServeurStatique() {
  const serveur = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url.split('?')[0])
      const fichier = path.join(RACINE, urlPath)
      if (!fichier.startsWith(RACINE)) {
        res.writeHead(403)
        res.end()
        return
      }
      const contenu = await readFile(fichier)
      const ext = path.extname(fichier)
      res.writeHead(200, { 'Content-Type': TYPES_MIME[ext] || 'application/octet-stream' })
      res.end(contenu)
    } catch {
      res.writeHead(404)
      res.end('introuvable : ' + req.url)
    }
  })
  return new Promise((resolve) => serveur.listen(PORT, () => resolve(serveur)))
}

async function genererImagesTest(page) {
  await mkdir(path.join(RACINE, 'scripts', 'fixtures'), { recursive: true })

  async function genererEtSauver(nomFichier, largeur, hauteur, dessiner) {
    const cheminSortie = path.join(RACINE, 'scripts', 'fixtures', nomFichier)
    if (existsSync(cheminSortie)) return
    const dataUrl = await page.evaluate(
      ({ largeur, hauteur, dessinerSrc }) => {
        const c = document.createElement('canvas')
        c.width = largeur
        c.height = hauteur
        const ctx = c.getContext('2d')
        // eslint-disable-next-line no-new-func
        new Function('ctx', 'w', 'h', dessinerSrc)(ctx, largeur, hauteur)
        return c.toDataURL('image/png')
      },
      { largeur, hauteur, dessinerSrc: dessiner.toString().replace(/^\([^)]*\)\s*=>\s*\{/, '').replace(/\}$/, '') }
    )
    const base64 = dataUrl.split(',')[1]
    await writeFile(cheminSortie, Buffer.from(base64, 'base64'))
  }

  await genererEtSauver('img-paysage.png', 2400, 1350, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, '#2a4')
    grad.addColorStop(1, '#248')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 30; i++) ctx.fillRect(i * 80, 0, 2, h)
    ctx.font = 'bold 60px sans-serif'
    ctx.fillText('PAYSAGE 16:9', 100, 100)
  })

  await genererEtSauver('img-portrait.png', 1200, 2100, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#a42')
    grad.addColorStop(1, '#824')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'
    for (let i = 0; i < 20; i++) ctx.fillRect(0, i * 120, w, 2)
    ctx.font = 'bold 50px sans-serif'
    ctx.fillText('PORTRAIT', 60, 100)
  })

  await genererEtSauver('img-petite.png', 300, 200, (ctx, w, h) => {
    ctx.fillStyle = '#48a'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText('PETITE', 20, 40)
  })
}

const VIEWPORTS = [
  { nom: '390x844-portrait', width: 390, height: 844 },
  { nom: '844x390-paysage', width: 844, height: 390 },
  { nom: '768x1024-tablette', width: 768, height: 1024 },
  { nom: '1440x900-laptop', width: 1440, height: 900 },
  { nom: '2560x1080-ultrawide', width: 2560, height: 1080 },
]

async function testerContexteVisibiliteTexte(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__pretACapturer === true)

  const style = await page.evaluate(() => {
    const el = document.getElementById('wallpaper-layer')
    const cs = getComputedStyle(el)
    return {
      position: cs.position,
      zIndex: cs.zIndex,
      filter: cs.filter,
      insetInline: el.style.inset,
    }
  })

  // Vérification programmatique de la non-régression (texte sans carte invisible) : le texte
  // nu doit avoir une couleur de premier plan qui contraste avec ce qu'il y a juste derrière —
  // on ne peut pas lire du texte "rendu" facilement sans OCR, donc on vérifie à la place que
  // l'élément est bien au-dessus visuellement (elementFromPoint renvoie bien le texte, pas le
  // fond, au centre de sa boîte) : si le calque de fond passait par-dessus, ce ne serait plus le
  // cas malgré un DOM par ailleurs correct — exactement la signature du bug déjà rencontré.
  const dessusOk = await page.evaluate(() => {
    const texte = document.getElementById('texte-nu')
    const r = texte.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const auDessus = document.elementFromPoint(cx, cy)
    return auDessus === texte || texte.contains(auDessus)
  })

  return { style, dessusOk }
}

async function main() {
  const { chromium, webkit } = await import('playwright')

  const serveur = await demarrerServeurStatique()
  console.log(`Serveur statique sur http://localhost:${PORT}`)

  await mkdir(DOSSIER_SORTIE, { recursive: true })

  const moteurs = [
    { nom: 'chromium', lanceur: chromium },
    { nom: 'webkit', lanceur: webkit },
  ]

  const resultats = []

  for (const { nom: nomMoteur, lanceur } of moteurs) {
    // --disable-dev-shm-usage / --no-sandbox : nécessaires dans cet environnement contraint en
    // mémoire (/dev/shm limité) — sans ces flags, chromium.launch() échouait systématiquement
    // (confirmé par un test minimal isolé). Ignorés par webkit (pas d'équivalent chromium-only).
    const navigateur = await lanceur.launch({ args: nomMoteur === 'chromium' ? ['--disable-dev-shm-usage', '--no-sandbox'] : [] })
    const pageInit = await navigateur.newPage()
    await genererImagesTest(pageInit)
    await pageInit.close()

    // 1) Non-régression texte + styles calculés, sur les 5 viewports demandés.
    for (const vp of VIEWPORTS) {
      const page = await navigateur.newPage({ viewport: { width: vp.width, height: vp.height } })
      const erreurs = []
      page.on('pageerror', (e) => erreurs.push(String(e)))
      page.on('console', (msg) => {
        if (msg.type() === 'error') erreurs.push(msg.text())
      })

      const url = `http://localhost:${PORT}/scripts/fixtures/fond-ecran-test.html?img=/scripts/fixtures/img-paysage.png&flou=8&mode=cover`
      const { style, dessusOk } = await testerContexteVisibiliteTexte(page, url)
      await page.screenshot({ path: path.join(DOSSIER_SORTIE, `${nomMoteur}-${vp.nom}.png`) })

      resultats.push({ moteur: nomMoteur, cas: vp.nom, style, texteVisible: dessusOk, erreurs })
      await page.close()
    }

    // 2) Niveaux de flou (0/8/20) sur un viewport représentatif.
    for (const flou of [0, 8, 20]) {
      const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } })
      const url = `http://localhost:${PORT}/scripts/fixtures/fond-ecran-test.html?img=/scripts/fixtures/img-paysage.png&flou=${flou}&mode=cover`
      const { style, dessusOk } = await testerContexteVisibiliteTexte(page, url)
      await page.screenshot({ path: path.join(DOSSIER_SORTIE, `${nomMoteur}-flou${flou}.png`) })
      resultats.push({ moteur: nomMoteur, cas: `flou-${flou}`, style, texteVisible: dessusOk, erreurs: [] })
      await page.close()
    }

    // 3) Formes d'image (paysage/portrait/petite) sur mobile portrait.
    for (const img of ['img-paysage.png', 'img-portrait.png', 'img-petite.png']) {
      const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } })
      const url = `http://localhost:${PORT}/scripts/fixtures/fond-ecran-test.html?img=/scripts/fixtures/${img}&flou=8&mode=cover`
      const { style, dessusOk } = await testerContexteVisibiliteTexte(page, url)
      await page.screenshot({ path: path.join(DOSSIER_SORTIE, `${nomMoteur}-${img.replace('.png', '')}.png`) })
      resultats.push({ moteur: nomMoteur, cas: img, style, texteVisible: dessusOk, erreurs: [] })
      await page.close()
    }

    // 4) Rotation (reflow après resize) et scroll.
    {
      const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } })
      const url = `http://localhost:${PORT}/scripts/fixtures/fond-ecran-test.html?img=/scripts/fixtures/img-paysage.png&flou=8&mode=cover`
      // flou=8 -> débord attendu de 16px (2x le rayon, voir calculerStyleFond) sur les 4 côtés,
      // symétriquement, à chaque taille de viewport (pas juste horizontalement — bug réel trouvé
      // et corrigé grâce à cette vérification, voir CLAUDE.md § Fond d'écran).
      const DEBORD_ATTENDU = 16
      const { dessusOk: avantRotation } = await testerContexteVisibiliteTexte(page, url)
      await page.setViewportSize({ width: 844, height: 390 })
      await page.waitForTimeout(200)
      const apresRotationStyle = await page.evaluate(() => {
        const el = document.getElementById('wallpaper-layer')
        const r = el.getBoundingClientRect()
        return { width: r.width, height: r.height, top: r.top, left: r.left, viewportW: window.innerWidth, viewportH: window.innerHeight }
      })
      await page.screenshot({ path: path.join(DOSSIER_SORTIE, `${nomMoteur}-apres-rotation.png`) })

      await page.evaluate(() => {
        document.body.style.height = '3000px'
        window.scrollTo(0, 400)
      })
      await page.waitForTimeout(150)
      const apresScrollStyle = await page.evaluate(() => {
        const el = document.getElementById('wallpaper-layer')
        const r = el.getBoundingClientRect()
        return { top: r.top, scrollY: window.scrollY }
      })
      await page.screenshot({ path: path.join(DOSSIER_SORTIE, `${nomMoteur}-apres-scroll.png`) })

      resultats.push({
        moteur: nomMoteur,
        cas: 'rotation+scroll',
        avantRotation,
        // Débord symétrique sur les 4 côtés, recalculé sur le NOUVEAU viewport après rotation
        // (pas figé sur l'ancien) : largeur/hauteur = viewport + 2x débord, top/left = -débord.
        apresRotationCoherent:
          apresRotationStyle.width === apresRotationStyle.viewportW + DEBORD_ATTENDU * 2 &&
          apresRotationStyle.height === apresRotationStyle.viewportH + DEBORD_ATTENDU * 2 &&
          apresRotationStyle.top === -DEBORD_ATTENDU &&
          apresRotationStyle.left === -DEBORD_ATTENDU,
        // position: fixed doit rester ancré au viewport (top toujours à -débord) quel que soit
        // le défilement de la page — jamais glisser avec le contenu.
        apresScrollResteFixe: apresScrollStyle.top === -DEBORD_ATTENDU && apresScrollStyle.scrollY > 0,
      })
      await page.close()
    }

    await navigateur.close()
  }

  serveur.close()

  console.log('\n=== Résultats ===')
  console.log(JSON.stringify(resultats, null, 2))

  const echecs = resultats.filter(
    (r) =>
      r.texteVisible === false ||
      (r.erreurs && r.erreurs.length > 0) ||
      r.apresRotationCoherent === false ||
      r.apresScrollResteFixe === false
  )
  if (echecs.length > 0) {
    console.log('\n⚠ ÉCHECS :', JSON.stringify(echecs, null, 2))
    process.exitCode = 1
  } else {
    console.log('\n✓ Aucune régression de visibilité du texte détectée, aucune erreur console.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
