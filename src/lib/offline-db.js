// IndexedDB générique (§8 lot 8) : un seul petit wrapper par magasin (cibles téléchargées,
// tentatives en attente, images) plutôt que trois implémentations séparées. Toute l'API est
// asynchrone (Promise), jamais de callback exposé à l'appelant.

const NOM_BASE = 'studik-externat-offline'
const VERSION_BASE = 1

export const MAGASIN_CIBLES = 'cibles_hors_ligne'
export const MAGASIN_TENTATIVES_EN_ATTENTE = 'tentatives_en_attente'
export const MAGASIN_IMAGES = 'images_hors_ligne'

const CLES_PAR_MAGASIN = {
  [MAGASIN_CIBLES]: 'cible',
  [MAGASIN_TENTATIVES_EN_ATTENTE]: 'id',
  [MAGASIN_IMAGES]: 'url',
}

function ouvrirBase() {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(NOM_BASE, VERSION_BASE)
    requete.onupgradeneeded = () => {
      const db = requete.result
      Object.entries(CLES_PAR_MAGASIN).forEach(([nom, cle]) => {
        if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, { keyPath: cle })
      })
    }
    requete.onsuccess = () => resolve(requete.result)
    requete.onerror = () => reject(requete.error)
  })
}

function promisifier(requete) {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => resolve(requete.result)
    requete.onerror = () => reject(requete.error)
  })
}

export async function sauverDansMagasin(nomMagasin, valeur) {
  const db = await ouvrirBase()
  const tx = db.transaction(nomMagasin, 'readwrite')
  tx.objectStore(nomMagasin).put(valeur)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listerMagasin(nomMagasin) {
  const db = await ouvrirBase()
  const tx = db.transaction(nomMagasin, 'readonly')
  return promisifier(tx.objectStore(nomMagasin).getAll())
}

export async function obtenirDuMagasin(nomMagasin, cle) {
  const db = await ouvrirBase()
  const tx = db.transaction(nomMagasin, 'readonly')
  return promisifier(tx.objectStore(nomMagasin).get(cle))
}

export async function supprimerDuMagasin(nomMagasin, cle) {
  const db = await ouvrirBase()
  const tx = db.transaction(nomMagasin, 'readwrite')
  tx.objectStore(nomMagasin).delete(cle)
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function compterMagasin(nomMagasin) {
  const db = await ouvrirBase()
  const tx = db.transaction(nomMagasin, 'readonly')
  return promisifier(tx.objectStore(nomMagasin).count())
}

export async function viderMagasin(nomMagasin) {
  const db = await ouvrirBase()
  const tx = db.transaction(nomMagasin, 'readwrite')
  tx.objectStore(nomMagasin).clear()
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
