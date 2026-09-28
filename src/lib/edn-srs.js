// Répétition espacée EDN (§7.1) — UNIQUEMENT en mode Externat, décision actée au §0.3 de la
// spec (le mode P2 n'a et n'aura jamais de SRS, voir CLAUDE.md). Fonctions pures, aucun accès
// réseau — testées dans edn-srs.test.js.

// "Méthode des J" — constante unique, facile à modifier (§7.1).
export const PALIERS_JOURS = [1, 3, 7, 14, 30, 60, 120]

export const SEUIL_REUSSITES_PARFAITES_PRIORITAIRE = 3

function ajouterJours(date, jours) {
  const d = new Date(date)
  d.setDate(d.getDate() + jours)
  return d
}

// Calcule le nouvel état SRS d'une cible après une tentative. `etapeActuelle`/
// `reussitesParfaitesConsecutives` valent leur défaut (-1 / 0) pour une cible jamais rencontrée
// (§7.1 "première rencontre") : un premier succès (s ≥ 0,5) l'amène directement au premier
// palier (J+1), un échec (s < 0,5) aussi — les deux convergent puisque le premier palier EST J+1.
export function prochainEtatSrs({ etapeActuelle = -1, reussitesParfaitesConsecutives = 0, scoreNormalise, prioritaire = false, maintenant = new Date() }) {
  let nouvelleEtape
  let nouveauCompteur = 0

  if (scoreNormalise === 1) {
    if (prioritaire) {
      nouveauCompteur = reussitesParfaitesConsecutives + 1
      if (nouveauCompteur >= SEUIL_REUSSITES_PARFAITES_PRIORITAIRE) {
        nouvelleEtape = etapeActuelle + 1
        nouveauCompteur = 0
      } else {
        nouvelleEtape = -1 // revient à J+1 pendant l'accumulation des 3 réussites
      }
    } else {
      nouvelleEtape = etapeActuelle + 1
    }
  } else if (scoreNormalise >= 0.5) {
    nouvelleEtape = etapeActuelle // même palier, relancé à partir d'aujourd'hui
  } else {
    nouvelleEtape = -1 // retour au premier palier
  }

  nouvelleEtape = Math.max(0, Math.min(nouvelleEtape, PALIERS_JOURS.length - 1))

  return {
    etape: nouvelleEtape,
    reussitesParfaitesConsecutives: nouveauCompteur,
    prochaineRevision: ajouterJours(maintenant, PALIERS_JOURS[nouvelleEtape]),
    derniereRevision: new Date(maintenant),
  }
}

// Plafond anti-surcharge (§7.1) : au-delà du réglage "révisions max / jour", les cibles dues sont
// triées par priorité (item prioritaire d'abord, puis retard le plus ancien), le reste est
// reporté (pas exclu — il reste dû, juste pas affiché aujourd'hui).
export function selectionnerCiblesDues(cibles, plafond) {
  const triees = [...cibles].sort((a, b) => {
    if (Boolean(a.prioritaire) !== Boolean(b.prioritaire)) return a.prioritaire ? -1 : 1
    return new Date(a.prochaineRevision) - new Date(b.prochaineRevision)
  })
  return triees.slice(0, plafond)
}

// Une cible est "due" si elle a une prochaine_revision passée ou égale à aujourd'hui, et qu'elle
// n'est pas suspendue.
export function estDue(etatSrs, maintenant = new Date()) {
  if (!etatSrs || etatSrs.suspendue) return false
  if (!etatSrs.prochaine_revision) return false
  return new Date(etatSrs.prochaine_revision) <= maintenant
}
