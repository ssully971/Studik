import { supabase } from './supabase.js'

const BUCKET = 'studik-images'

// Plus grand côté (largeur OU hauteur, selon l'orientation) au-delà duquel l'image est
// redimensionnée — une seule fois, jamais itérativement. En-dessous, la résolution d'origine
// est conservée intégralement. Choisi généreux (la plupart des captures d'écran iPhone/iPad/
// moniteur externe ne sont pas concernées) car la qualité prime sur la taille de fichier pour
// une application de travail médical : un texte de capture doit rester lisible.
const PLUS_GRAND_COTE_MAX = 3000

// PNG/GIF source = très probablement une capture d'écran, un tableau ou un schéma (aplats de
// couleur, texte fin) : ré-encoder en JPEG y créerait des artefacts de bloc autour des contours
// nets, illisibles sur du petit texte. On reste dans un format SANS PERTE (PNG) pour ce cas.
function estProbablementGraphique(file) {
  return file.type === 'image/png' || file.type === 'image/gif'
}

function chargerImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Impossible de charger l'image."))
    }
    img.src = url
  })
}

function canvasVersBlob(canvas, type, qualite) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Impossible de traiter l'image."))
      else resolve(blob)
    }, type, qualite)
  })
}

// Un seul passage : redimensionne au plus une fois (jamais de boucle "si toujours trop lourd,
// réessaie en pire qualité"), garde le ratio d'origine exact, choisit un format adapté au
// contenu plutôt que d'imposer JPEG à tout. Ne jamais recadrer : drawImage couvre toujours la
// totalité de l'image source dans un canvas aux mêmes proportions.
async function compresserImage(file) {
  const img = await chargerImage(file)

  const plusGrandCote = Math.max(img.width, img.height)
  const echelle = plusGrandCote > PLUS_GRAND_COTE_MAX ? PLUS_GRAND_COTE_MAX / plusGrandCote : 1
  const largeur = Math.max(1, Math.round(img.width * echelle))
  const hauteur = Math.max(1, Math.round(img.height * echelle))

  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  canvas.getContext('2d').drawImage(img, 0, 0, largeur, hauteur)

  if (estProbablementGraphique(file)) {
    return canvasVersBlob(canvas, 'image/png')
  }

  // Photo : WebP à qualité élevée si le navigateur sait vraiment l'encoder — vérifié sur le
  // type MIME réel du blob renvoyé plutôt que supposé, certaines versions de Safari acceptent
  // l'appel sans erreur mais retombent silencieusement sur un autre format. Sinon JPEG qualité
  // 0.92 (contre 0.82 avant), sans jamais redescendre plus bas.
  const blobWebp = await canvasVersBlob(canvas, 'image/webp', 0.92)
  if (blobWebp.type === 'image/webp') return blobWebp
  return canvasVersBlob(canvas, 'image/jpeg', 0.92)
}

const EXTENSION_PAR_TYPE = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
}

export async function televerserImage(file) {
  const blob = await compresserImage(file)
  const extension = EXTENSION_PAR_TYPE[blob.type] || 'jpg'
  const nomFichier = `${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(nomFichier, blob, { contentType: blob.type })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nomFichier)
  return data.publicUrl
}

export async function supprimerImage(url) {
  const nomFichier = url.split('/').pop()
  const { data, error } = await supabase.storage.from(BUCKET).remove([nomFichier])
  if (error) throw error
  // Supabase ne renvoie pas toujours une erreur quand la policy RLS du bucket interdit la
  // suppression : la requête "réussit" silencieusement sans rien supprimer (data vide). Sans
  // cette vérification explicite, l'image reste orpheline dans le stockage sans qu'on le sache.
  if (!data || data.length === 0) {
    throw new Error("Le fichier n'a pas pu être supprimé du stockage (policy RLS manquante pour la suppression sur ce bucket).")
  }
}
