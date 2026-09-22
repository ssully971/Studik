// Remplace window.confirm() par une modale in-page : certains contextes (webview embarquée,
// navigateur de prévisualisation) suppriment ou auto-répondent aux dialogues natifs, ce qui
// rend les actions destructives silencieusement inopérantes sans que rien ne s'affiche.
let overlay = null

function creerOverlay() {
  const div = document.createElement('div')
  div.className = 'modal-overlay hidden'
  div.innerHTML = `
    <div class="modal-panel" style="max-width: 420px;">
      <p id="confirmer-message" style="margin-bottom: 18px;"></p>
      <div class="import-actions">
        <button type="button" id="confirmer-annuler" class="btn" style="width: auto;">Annuler</button>
        <button type="button" id="confirmer-valider" class="btn primary" style="width: auto; background: #C46A5C; border-color: #C46A5C;">Confirmer</button>
      </div>
    </div>
  `
  document.body.appendChild(div)
  return div
}

export function demanderConfirmation(message) {
  if (!overlay || !document.body.contains(overlay)) overlay = creerOverlay()

  return new Promise((resolve) => {
    overlay.querySelector('#confirmer-message').textContent = message
    overlay.classList.remove('hidden')

    const boutonAnnuler = overlay.querySelector('#confirmer-annuler')
    const boutonValider = overlay.querySelector('#confirmer-valider')

    function nettoyer(resultat) {
      overlay.classList.add('hidden')
      boutonAnnuler.removeEventListener('click', surAnnuler)
      boutonValider.removeEventListener('click', surValider)
      overlay.removeEventListener('click', surClicExterieur)
      resolve(resultat)
    }
    function surAnnuler() {
      nettoyer(false)
    }
    function surValider() {
      nettoyer(true)
    }
    function surClicExterieur(e) {
      if (e.target === overlay) nettoyer(false)
    }

    boutonAnnuler.addEventListener('click', surAnnuler)
    boutonValider.addEventListener('click', surValider)
    overlay.addEventListener('click', surClicExterieur)
  })
}
