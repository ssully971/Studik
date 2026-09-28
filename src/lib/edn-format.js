// Rang docimologique (§4.2 de la spec) : PAS une colonne, une constante dérivée du format.
// "Seules les questions « double A » (connaissance A + format A) comptent pour le seuil de
// validation de 14/20." — rang de la connaissance (colonne `rang` sur edn_questions) ET format
// doivent être A pour compter en double-A.

export const FORMATS_RANG_A = ['QRU', 'QRP', 'QROC', 'ZAP']
export const FORMATS_RANG_B = ['QRM', 'QRP_LONG', 'TCS']

export function rangFormat(format) {
  if (FORMATS_RANG_A.includes(format)) return 'A'
  if (FORMATS_RANG_B.includes(format)) return 'B'
  return null
}

// "Double A" : la connaissance évaluée (rang de la question) ET le format sont tous deux de
// rang A. Sert au calcul de la note AA estimée (§7.2/§7, tableau de bord et stats).
export function estDoubleA(question) {
  return question.rang === 'A' && rangFormat(question.format) === 'A'
}
