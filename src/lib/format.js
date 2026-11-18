export const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Number(n || 0)).toFixed(2)
export const fmtDate = (t) => new Date(t).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
export const dayKey = (t) => new Date(t).toLocaleDateString('en-CA')
export const TAX_DIV = 11 // prices include 10% tax, so tax = total / 11
export const PAYMENTS = ['Cash', 'Card', 'Amex', 'Store credit']

export function downloadCsv(name, rows) {
  const body = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }))
  a.download = name
  a.click()
}
export const iso = (t) => new Date(t).toLocaleDateString('en-CA')
export const addDays = (t, n) => t + n * 864e5
