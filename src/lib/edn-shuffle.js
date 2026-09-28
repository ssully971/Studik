// Fisher-Yates (§5.1 : "Mélange : l'ordre est tiré au hasard à chaque affichage"). `alea` est
// injectable pour un test déterministe ; ne mute jamais le tableau reçu.
export function melangerFisherYates(tableau, alea = Math.random) {
  const copie = [...tableau]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}
