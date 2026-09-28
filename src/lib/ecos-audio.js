// Bip synthétisé (Web Audio), jamais un fichier audio (§5.9) — signal sonore au début/à la fin du
// chrono ECOS et à l'alerte finale. Best-effort : une erreur (API indisponible/bloquée) ne doit
// jamais interrompre le chrono lui-même, d'où le try/catch qui avale tout.
let ctxPartage = null

function obtenirContexte() {
  if (!ctxPartage) {
    const AudioContextImpl = window.AudioContext || window.webkitAudioContext
    if (!AudioContextImpl) return null
    ctxPartage = new AudioContextImpl()
  }
  return ctxPartage
}

export function jouerBip(frequence = 880, dureeMs = 200) {
  try {
    const ctx = obtenirContexte()
    if (!ctx) return
    const oscillateur = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillateur.frequency.value = frequence
    oscillateur.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    oscillateur.start()
    oscillateur.stop(ctx.currentTime + dureeMs / 1000)
  } catch {
    // Best-effort : le chrono ne doit jamais dépendre de l'audio.
  }
}
