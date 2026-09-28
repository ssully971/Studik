// "Préparer le hors-ligne" (§8 lot 8) : télécharge dans IndexedDB les cibles dues du jour (au
// plafond, §7.1) et leurs images, pour pouvoir les CONSULTER hors connexion. Ne prépare pas un
// mode de jeu hors-ligne complet (les tentatives se rejouent au retour du réseau via
// offline-queue.js) — juste le contenu à afficher, pour ne pas dépasser le périmètre du lot.
import { getCiblesDuesTriees, getPlafondRevisions } from './edn-dashboard.js'
import { getQuestionById, getDossierAvecQuestions } from './edn-content.js'
import { sauverDansMagasin, listerMagasin, viderMagasin, MAGASIN_CIBLES, MAGASIN_IMAGES } from './offline-db.js'

function collecterImages(type, contenu) {
  if (type === 'q') return contenu.image ? [contenu.image] : []
  return (contenu.questions || []).filter((q) => q.image).map((q) => q.image)
}

async function telechargerImage(url) {
  try {
    const reponse = await fetch(url)
    if (!reponse.ok) return
    const blob = await reponse.blob()
    await sauverDansMagasin(MAGASIN_IMAGES, { url, blob })
  } catch (err) {
    // Une image qui échoue à se télécharger ne doit pas faire échouer toute la préparation —
    // elle sera simplement absente hors-ligne, comme si elle n'avait jamais chargé.
    console.error('Erreur téléchargement image hors-ligne', url, err)
  }
}

export async function preparerHorsLigne({ onProgression } = {}) {
  const plafond = await getPlafondRevisions()
  const cibles = await getCiblesDuesTriees(plafond)

  await viderMagasin(MAGASIN_CIBLES)
  await viderMagasin(MAGASIN_IMAGES)

  let traitees = 0
  for (const c of cibles) {
    const [type, id] = c.cible.split(':')
    const contenu = type === 'q' ? await getQuestionById(id) : await getDossierAvecQuestions(id)
    await sauverDansMagasin(MAGASIN_CIBLES, { cible: c.cible, type, contenu, dateTelechargement: new Date().toISOString() })

    for (const url of collecterImages(type, contenu)) {
      await telechargerImage(url)
    }

    traitees++
    onProgression?.(traitees, cibles.length)
  }

  return { nombreCibles: cibles.length }
}

export async function getCiblesHorsLigne() {
  return listerMagasin(MAGASIN_CIBLES)
}
