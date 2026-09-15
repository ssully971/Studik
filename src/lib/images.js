import { supabase } from './supabase.js'

const BUCKET = 'studik-images'
const TAILLE_MAX_OCTETS = 500 * 1024

function compresserImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      function essayer(largeur, qualite, tentative) {
        const hauteur = Math.round((img.height * largeur) / img.width)
        canvas.width = largeur
        canvas.height = hauteur
        ctx.clearRect(0, 0, largeur, hauteur)
        ctx.drawImage(img, 0, 0, largeur, hauteur)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Impossible de traiter l'image."))
              return
            }
            if (blob.size <= TAILLE_MAX_OCTETS || tentative >= 8) {
              resolve(blob)
            } else if (tentative % 2 === 0) {
              essayer(largeur, qualite * 0.7, tentative + 1)
            } else {
              essayer(Math.round(largeur * 0.8), qualite, tentative + 1)
            }
          },
          'image/jpeg',
          qualite
        )
      }

      essayer(Math.min(img.width, 1600), 0.82, 0)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Impossible de charger l'image."))
    }

    img.src = url
  })
}

export async function televerserImage(file) {
  const blob = await compresserImage(file)
  if (blob.size > TAILLE_MAX_OCTETS) {
    throw new Error(`Image trop lourde même après compression (${Math.round(blob.size / 1024)} Ko, limite 500 Ko).`)
  }

  const nomFichier = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(nomFichier, blob, { contentType: 'image/jpeg' })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nomFichier)
  return data.publicUrl
}

export async function supprimerImage(url) {
  const nomFichier = url.split('/').pop()
  const { error } = await supabase.storage.from(BUCKET).remove([nomFichier])
  if (error) throw error
}
