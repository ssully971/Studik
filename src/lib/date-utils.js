function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatLocalDate(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function todayLocal() {
  return formatLocalDate(new Date())
}

export function addDays(str, delta) {
  const d = parseLocalDate(str)
  d.setDate(d.getDate() + delta)
  return formatLocalDate(d)
}
