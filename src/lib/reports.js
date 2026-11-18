import { PAYMENTS, TAX_DIV } from './format.js'

export const liveSales = (db) => db.sales.filter((s) => s.status !== 'refunded')
export const qtyOf = (db, productId, outletId) => db.stock.find((s) => s.productId === productId && s.outletId === outletId)?.qty || 0
export const openSession = (db, outletId) => db.sessions.find((s) => s.outletId === outletId && !s.closedAt)
export const inRange = (t, from, to) => t >= new Date(from + 'T00:00:00').getTime() && t < new Date(to + 'T00:00:00').getTime() + 864e5

// Money taken at one outlet between two times. Special-order deposits count as takings but not as sales.
export function sessionStats(db, outletId, from, to) {
  const tenders = {}
  PAYMENTS.forEach((p) => (tenders[p] = { n: 0, v: 0 }))
  let net = 0, tax = 0, count = 0, deposits = 0
  liveSales(db).filter((s) => s.outletId === outletId && s.t >= from && s.t <= to).forEach((s) => {
    net += s.total; tax += s.tax; count++
    const t = tenders[s.payment.method]
    t.n++; t.v += s.total - (s.depositApplied || 0)
  })
  ;(db.orders || []).forEach((o) => o.payments.forEach((p) => {
    if (p.outletId === outletId && p.t >= from && p.t <= to) { tenders[p.method].n++; tenders[p.method].v += p.amount; deposits += p.amount }
  }))
  const takings = PAYMENTS.reduce((a, p) => a + tenders[p].v, 0)
  return { net, tax, count, tenders, deposits, takings }
}

export const stockStatus = (qty, reorder) =>
  qty <= 0 ? { label: 'Out of stock', tone: 'red' } : qty <= reorder ? { label: 'Low', tone: 'amber' } : { label: 'In stock', tone: 'green' }

// outletFilter: 'all' or an outlet id. q matches barcode / product number, name or category (brand).
export function inventoryRows(db, outletFilter, q) {
  const t = q.trim().toLowerCase()
  return db.products
    .filter((p) => !t || (p.sku + ' ' + p.name + ' ' + p.category).toLowerCase().includes(t))
    .map((p) => {
      const qty = {}
      db.outlets.forEach((o) => (qty[o.id] = qtyOf(db, p.id, o.id)))
      const shown = outletFilter === 'all' ? db.outlets.map((o) => o.id) : [outletFilter]
      const total = shown.reduce((a, id) => a + qty[id], 0)
      return { product: p, qty, shown, total, costValue: total * p.cost, retailValue: total * p.price }
    })
}

export function salesReport(db, { from, to, outletId, groupBy }) {
  const G = new Map()
  const add = (k, id, units, net, cost) => {
    const g = G.get(k) || { ids: new Set(), units: 0, net: 0, tax: 0, profit: 0 }
    g.ids.add(id); g.units += units; g.net += net; g.tax += net / TAX_DIV; g.profit += net - net / TAX_DIV - cost
    G.set(k, g)
  }
  const uname = (id) => db.users.find((u) => u.id === id)?.name || '-'
  const cname = (id) => db.customers.find((c) => c.id === id)?.name || 'Walk-in'
  const list = liveSales(db).filter((s) => inRange(s.t, from, to) && (outletId === 'all' || s.outletId === outletId))
  list.forEach((s) => {
    if (groupBy === 'category' || groupBy === 'product') {
      s.items.forEach((i) => add(groupBy === 'category' ? i.category : i.name, s.id, i.qty, i.net, i.cost * i.qty))
    } else {
      const k = { day: () => new Date(s.t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }), cashier: () => uname(s.cashierId), payment: () => s.payment.method, customer: () => cname(s.customerId) }[groupBy]()
      add(k, s.id, s.items.reduce((a, i) => a + i.qty, 0), s.total, s.items.reduce((a, i) => a + i.cost * i.qty, 0))
    }
  })
  const rows = [...G].map(([k, g]) => ({ k, orders: g.ids.size, units: g.units, net: g.net, tax: g.tax, profit: g.profit }))
  if (groupBy !== 'day') rows.sort((a, b) => b.net - a.net)
  const total = rows.reduce((a, r) => ({ units: a.units + r.units, net: a.net + r.net, tax: a.tax + r.tax, profit: a.profit + r.profit }), { units: 0, net: 0, tax: 0, profit: 0 })
  total.orders = list.length
  return { rows, total }
}
