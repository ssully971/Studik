// src/lib/loader.js
//
// Loader "Feuillet" : mime une fiche de révision en cours de remplissage.
// Pensé pour le chargement initial de l'app (le temps que getCurrentUser()
// réponde, dans main.js -> init()), avant que renderShell ou renderLogin ne
// prenne la main. Peut aussi servir pour toute transition de route un peu
// longue.
//
// Le CSS correspondant vit dans main.css (section "Loader Feuillet", fin du
// fichier) et réutilise les tokens déjà définis là-bas (--clinique,
// --mecanisme, --structure, --surface, etc.) : aucune variable à redéfinir
// ici.

const MOTS = ['chargement', 'référentiel', 'entraînement', 'révision']

/**
 * Injecte le loader dans `cible` et démarre la légende défilante.
 *
 * @param {HTMLElement} cible - conteneur dans lequel injecter le loader
 *   (typiquement #app avant le premier rendu, ou #content pendant une
 *   transition de route).
 * @returns {() => void} fonction à appeler pour arrêter la légende avant de
 *   remplacer le contenu de `cible` — sans ça le setInterval continue de
 *   tourner dans le vide une fois le loader retiré du DOM.
 */
export function afficherLoader(cible) {
  cible.innerHTML = `
    <div class="loader-wrap">
      <div class="card">
        <div class="tab"></div>
        <div class="card-body">
          <div class="type-label">fiche</div>
          <div class="title-line"></div>
          <div class="card-line l1"></div>
          <div class="card-line l2"></div>
        </div>
      </div>
      <div class="wordmark voice">Studik</div>
      <div class="caption" id="loader-caption">chargement</div>
    </div>
  `

  let i = 0
  const el = cible.querySelector('#loader-caption')

  const intervalId = setInterval(() => {
    i = (i + 1) % MOTS.length
    el.style.opacity = 0
    setTimeout(() => {
      el.textContent = MOTS[i]
      el.style.opacity = 1
    }, 250)
  }, 2200)

  return () => clearInterval(intervalId)
}
