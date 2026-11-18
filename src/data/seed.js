import { checkDigit } from '../lib/barcode.js'
import { hashPin } from '../lib/security.js'
import { priceLines } from '../lib/pricing.js'
import { startOfDay, iso } from '../lib/format.js'

export const OUTLETS = [{ id: 'syd', name: 'Sydney' }, { id: 'pnh', name: 'Phnom Penh' }]
const CATS = ['Gucci', 'Saint Laurent', 'Prada', 'Versace', 'Dior', 'Accessories']
// [category, name, retail price, cost, colour]
const PRODUCTS = [
  [0, 'Oversized Square Black', 489, 190, '#111111'], [0, 'Cat-eye Tortoise', 529, 200, '#8b5a2b'], [0, 'Round Gold Metal', 559, 215, '#c9a227'],
  [1, 'Classic Black Acetate', 459, 175, '#111111'], [1, 'Slim Square Havana', 479, 180, '#8b5a2b'], [1, 'Aviator Gunmetal', 499, 190, '#6b7280'],
  [2, 'Linea Rossa Wrap', 429, 160, '#ef4444'], [2, 'Rectangle Black', 389, 145, '#1f2937'],
  [3, 'Medusa Round Gold', 449, 170, '#d4a017'], [3, 'Oval Violet', 419, 155, '#7c3aed'],
  [4, 'Mini Cat-eye Pink', 579, 220, '#e879a9'], [4, 'Square Navy', 539, 205, '#1e3a8a'],
  [5, 'Hard case', 24, 6, '#64748b'], [5, 'Lens cleaning kit', 12, 3, '#64748b'], [5, 'Strap cord', 15, 4, '#64748b'],
]

// Every collection below maps 1:1 to a table in docs/schema.sql
export function seed() {
  const now = Date.now()
  const categories = CATS.map((n, i) => ({ id: 'cat' + (i + 1), name: n }))
  const products = PRODUCTS.map((p, i) => {
    const b = '9320088' + String(1001 + i).padStart(5, '0')
    const cat = categories[p[0]]
    return { id: 'p' + (i + 1), sku: b + checkDigit(b), name: cat.name === 'Accessories' ? p[1] : cat.name + ' ' + p[1], categoryId: cat.id, price: p[2], wholesale: Math.round(p[2] * 0.7), cost: p[3], color: p[4], reorderLevel: 5 }
  })
  const withCat = products.map((p) => ({ ...p, category: categories.find((c) => c.id === p.categoryId).name }))
  const stock = []
  products.forEach((p, i) => {
    stock.push({ productId: p.id, outletId: 'syd', qty: 4 + ((i * 7) % 16) })
    stock.push({ productId: p.id, outletId: 'pnh', qty: (i * 5) % 13 })
  })
  const users = [['Dalin Lim', 'dalin@example.com', 'Admin'], ['Sam Carter', 'sam@example.com', 'Cashier'], ['Priya Singh', 'priya@example.com', 'Cashier']]
    .map((u, i) => ({ id: 'u' + (i + 1), name: u[0], email: u[1], role: u[2], pinHash: hashPin(u[1], '1234') }))
  const customers = [
    ['Mia', 'Thompson', '12 George St, Sydney NSW', '0412 555 101', 'mia@example.com', 50], ['Liam', 'Nguyen', '48 Street 240, Phnom Penh', '0412 555 102', 'liam@example.com', 0],
    ['Olivia', 'Brown', '7 Pitt St, Sydney NSW', '0412 555 103', 'olivia@example.com', 120], ['Noah', 'Wilson', '25 Norodom Blvd, Phnom Penh', '0412 555 104', 'noah@example.com', 0],
    ['Ava', 'Patel', '90 Oxford St, Sydney NSW', '0412 555 105', 'ava@example.com', 25],
  ].map((c, i) => ({ id: 'c' + (i + 1), first: c[0], last: c[1], name: c[0] + ' ' + c[1], address: c[2], phone: c[3], email: c[4], points: 0, spent: 0, credit: c[5] }))

  let s = 5
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280
  const sales = []
  let n = 1000
  for (let d = 13; d >= 0; d--) {
    const count = 3 + Math.floor(r() * 5)
    for (let k = 0; k < count; k++) {
      const t = new Date(); t.setDate(t.getDate() - d); t.setHours(9 + Math.floor(r() * 9), Math.floor(r() * 60))
      if (t > new Date()) continue
      const lines = []
      const nl = 1 + Math.floor(r() * 2)
      for (let j = 0; j < nl; j++) { const p = products[Math.floor(r() * products.length)]; lines.push({ lineId: p.id, productId: p.id, qty: 1, dt: '%', dv: r() > 0.8 ? 10 : 0 }) }
      const priced = priceLines(lines, withCat)
      const cu = r() > 0.55 ? customers[Math.floor(r() * customers.length)] : null
      const method = ['Card', 'Cash', 'Amex', 'Card'][Math.floor(r() * 4)]
      const tendered = method === 'Cash' ? Math.ceil(priced.total / 50) * 50 : priced.total
      if (cu) { cu.points += Math.floor(priced.total); cu.spent += priced.total }
      n++
      sales.push({ id: 's_' + n, number: n, t: t.getTime(), outletId: r() > 0.45 ? 'syd' : 'pnh', cashierId: 'u' + (2 + Math.floor(r() * 2)), customerId: cu ? cu.id : null, items: priced.items, subtotal: priced.subtotal, discount: priced.discount, total: priced.total, tax: priced.tax, payment: { method, tendered, change: tendered - priced.total }, kind: 'sale', status: 'completed' })
    }
  }
  sales.sort((a, b) => a.t - b.t)

  const mkPurchase = (number, outletId, daysAgo, supplier, invoiceNo, who, picks) => {
    const items = picks.map(([i, qty]) => ({ productId: products[i].id, sku: products[i].sku, name: products[i].name, qty, unitCost: products[i].cost, retail: products[i].price, wholesale: products[i].wholesale }))
    return { id: 'pu_' + number, number, t: now - daysAgo * 864e5, date: iso(now - daysAgo * 864e5), outletId, supplier, invoiceNo, notes: '', receivedBy: who, items, total: items.reduce((a, i) => a + i.qty * i.unitCost, 0) }
  }
  const purchases = [
    mkPurchase(1, 'syd', 10, 'Luxottica Distribution', 'INV-20418', 'u2', [[0, 6], [3, 6], [5, 4]]),
    mkPurchase(2, 'pnh', 6, 'Asia Optical Supply', 'AO-7731', 'u3', [[6, 8], [8, 8], [12, 20]]),
  ]
  const qLines = [{ lineId: 'p1', productId: 'p1', qty: 1, dt: '%', dv: 0 }, { lineId: 'c_seed', custom: { name: 'Prescription lenses (pair)', price: 180, cost: 70 }, qty: 1, dt: '%', dv: 0 }]
  const qp = priceLines(qLines, withCat)
  const quotes = [{ id: 'q_1', number: 1, t: now - 3 * 864e5, outletId: 'syd', createdBy: 'u2', customerId: 'c1', validUntil: iso(now + 11 * 864e5), notes: 'Includes prescription lenses.', items: qp.items, subtotal: qp.subtotal, discount: qp.discount, total: qp.total, tax: qp.tax, status: 'Open' }]
  const op = priceLines([{ lineId: 'p11', productId: 'p11', qty: 1, dt: '%', dv: 0 }], withCat)
  const orders = [{ id: 'o_1', number: 1, t: now - 2 * 864e5, outletId: 'syd', createdBy: 'u2', customerId: 'c3', items: op.items, subtotal: op.subtotal, discount: op.discount, total: op.total, tax: op.tax, expectedDate: iso(now + 5 * 864e5), notes: 'Ordered in from the supplier', status: 'Ordered', payments: [{ id: 'pay_1', t: now - 2 * 864e5, type: 'deposit', method: 'Cash', amount: 100, outletId: 'syd', userId: 'u2' }] }]
  const activity = sales.slice(-12).map((x) => ({ id: 'a_' + x.number, t: x.t, userId: x.cashierId, outletId: x.outletId, type: 'Sale', detail: `Sale #${x.number} $${x.total.toFixed(2)}` }))
  const o = startOfDay(now)
  return {
    outlets: OUTLETS, users, categories, products, stock, customers, sales, purchases, quotes, orders, activity,
    sessions: [{ id: 'r1', outletId: 'syd', openedAt: o, openedBy: 'u1', float: 200, closedAt: null }, { id: 'r2', outletId: 'pnh', openedAt: o, openedBy: 'u3', float: 200, closedAt: null }],
    holds: [], transfers: [], counters: { sale: n, quote: 1, order: 1, purchase: 2 },
  }
}
