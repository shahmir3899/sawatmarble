export function formatMoney(value: string | number) {
  const num = Number(value)
  return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// e.g. 2-Dec-2026
export function formatDate(value: Date | string) {
  const d = typeof value === 'string' ? new Date(value) : value
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  return `${day}-${month}-${d.getFullYear()}`
}

// e.g. 2-Dec-2026, 2:30 PM
export function formatDateTime(value: Date | string) {
  const d = typeof value === 'string' ? new Date(value) : value
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${formatDate(d)}, ${time}`
}
