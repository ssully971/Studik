function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function richText(str) {
  let out = escapeHtml(str)
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/==(.+?)==/g, '<mark class="rt-highlight">$1</mark>')
  out = out.replace(/!!(.+?)!!/g, '<span class="rt-important">$1</span>')
  return out
}
