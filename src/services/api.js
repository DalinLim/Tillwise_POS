// DATA LAYER. Everything the UI needs goes through `api`. Today it reads and writes localStorage;
// to use a real database, keep the same function names and replace the bodies with fetch() calls
// to your backend (REST, Supabase, Firebase...). The UI does not need to change.
// A real backend should also enforce roles, stock, tax and totals itself.
import { seed } from '../data/seed.js'
import { priceLines } from '../lib/pricing.js'
import { hashPin } from '../lib/security.js'
import { sessionStats, openSession } from '../lib/reports.js'

const KEY = 'tillwise-react-v2'
let cache = null
let actor = { userId: null, outletId: null, role: 'Cashier' } // who is acting; set by the app before each call
const db = () => {
  if (!cache) { try { cache = JSON.parse(localStorage.getItem(KEY)) } catch { /* ignore */ } }
  if (!cache) cache = seed()
  return cache
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* ignore */ } }
const clone = (v) => JSON.parse(JSON.stringify(v))
const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9)
const row = (d, productId, outletId) => d.stock.find((s) => s.productId === productId && s.outletId === outletId)
const fail = (m) => { throw new Error(m) }
const needAdmin = () => { if (actor.role !== 'Admin') fail('Only an Admin can do that.') }
const next = (d, k) => ++d.counters[k]
const money = (n) => '$' + n.toFixed(2)
const withCat = (d) => d.products.map((p) => ({ ...p, category: d.categories.find((c) => c.id === p.categoryId)?.name || 'Uncategorised' }))
const log = (d, type, detail, outletId, userId) => d.activity.push({ id: uid('a'), t: Date.now(), userId: userId || actor.userId, outletId: outletId || actor.outletId, type, detail })
const units = (items) => items.reduce((a, i) => a + i.qty, 0)

export const api = {
  setActor: (a) => { actor = a },
  snapshot: async () => { const d = db(); return clone({ ...d, products: withCat(d), users: d.users.map(({ pinHash, ...u }) => u) }) },
  reset: async () => { cache = seed(); save() },

  categories: {
    add: async (name) => {
      needAdmin()
      const d = db(), n = name.trim()
      if (!n) fail('Enter a category name.')
      if (d.categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) fail('That category already exists.')
      d.categories.push({ id: uid('cat'), name: n }); log(d, 'Category added', n); save()
    },
    remove: async (id) => {
      needAdmin()
      const d = db(), c = d.categories.find((x) => x.id === id)
      if (d.products.some((p) => p.categoryId === id)) fail('Move or delete the products in this category first.')
      d.categories = d.categories.filter((x) => x.id !== id); log(d, 'Category removed', c.name); save()
    },
  },

  products: {
    save: async (p) => {
      needAdmin()
      const d = db()
      if (!p.categoryId) fail('Choose a category.')
      if (d.products.some((x) => x.sku === p.sku && x.id !== p.id)) fail('That barcode is already used.')
      const fields = { sku: p.sku, name: p.name, categoryId: p.categoryId, price: p.price, wholesale: p.wholesale, cost: p.cost, color: p.color, reorderLevel: p.reorderLevel }
      if (p.id) { Object.assign(d.products.find((x) => x.id === p.id), fields); log(d, 'Product updated', p.name) }
      else {
        const id = uid('p')
        d.products.push({ id, ...fields })
        d.outlets.forEach((o) => d.stock.push({ productId: id, outletId: o.id, qty: p.stock?.[o.id] || 0 }))
        log(d, 'Product added', p.name + ' (' + p.sku + ')')
      }
      save()
    },
    remove: async (id) => {
      needAdmin()
      const d = db(), p = d.products.find((x) => x.id === id)
      d.products = d.products.filter((x) => x.id !== id); d.stock = d.stock.filter((s) => s.productId !== id); log(d, 'Product deleted', p.name); save()
    },
  },

  stock: {
    set: async ({ productId, levels }) => {
      needAdmin()
      const d = db(), p = d.products.find((x) => x.id === productId)
      Object.entries(levels).forEach(([o, q]) => { row(d, productId, o).qty = Math.max(0, q) })
      log(d, 'Stock adjusted', p.name + ': ' + Object.entries(levels).map(([o, q]) => o.toUpperCase() + ' ' + q).join(', ')); save()
    },
    transfer: async ({ productId, from, to, qty }) => {
      const d = db(), p = d.products.find((x) => x.id === productId)
      if (from === to) fail('Choose two different outlets.')
      if (!(qty >= 1)) fail('Enter a quantity.')
      const a = row(d, productId, from)
      if (a.qty < qty) fail('Not enough stock to transfer.')
      a.qty -= qty; row(d, productId, to).qty += qty
      d.transfers.push({ id: uid('t'), t: Date.now(), productId, from, to, qty, userId: actor.userId })
      log(d, 'Stock transferred', `${qty} × ${p.name}: ${from.toUpperCase()} to ${to.toUpperCase()}`, from); save()
    },
  },

  // Receiving stock from a supplier / factory against an invoice
  purchases: {
    receive: async ({ outletId, date, supplier, invoiceNo, notes, lines }) => {
      const d = db()
      if (!supplier.trim()) fail('Enter the supplier or factory.')
      if (!invoiceNo.trim()) fail('Enter the invoice number.')
      if (!lines.length) fail('Add at least one product.')
      const items = lines.map((l) => {
        const p = d.products.find((x) => x.id === l.productId)
        if (!(l.qty >= 1)) fail('Enter a quantity for ' + p.name)
        const unitCost = Number.isFinite(l.unitCost) ? l.unitCost : p.cost
        return { productId: p.id, sku: p.sku, name: p.name, qty: l.qty, unitCost, retail: p.price, wholesale: p.wholesale }
      })
      items.forEach((i) => { row(d, i.productId, outletId).qty += i.qty; d.products.find((p) => p.id === i.productId).cost = i.unitCost })
      const number = next(d, 'purchase')
      const pu = { id: 'pu_' + number, number, t: Date.now(), date, outletId, supplier: supplier.trim(), invoiceNo: invoiceNo.trim(), notes: notes || '', receivedBy: actor.userId, items, total: items.reduce((a, i) => a + i.qty * i.unitCost, 0) }
      d.purchases.push(pu)
      log(d, 'Stock received', `${units(items)} units from ${pu.supplier}, invoice ${pu.invoiceNo}`, outletId); save(); return clone(pu)
    },
  },

  customers: {
    create: async (c) => {
      const d = db()
      const n = { id: uid('c'), first: c.first, last: c.last, name: c.first + ' ' + c.last, address: c.address, phone: c.phone, email: c.email, points: 0, spent: 0, credit: 0 }
      d.customers.push(n); log(d, 'Customer added', n.name); save(); return clone(n)
    },
    addCredit: async (id, amount) => { const d = db(), c = d.customers.find((x) => x.id === id); c.credit += amount; log(d, 'Store credit added', `${money(amount)} for ${c.name}`); save() },
  },

  users: {
    create: async (u) => {
      needAdmin()
      const d = db()
      if (d.users.some((x) => x.email.toLowerCase() === u.email.toLowerCase())) fail('That email is already used.')
      d.users.push({ id: uid('u'), name: u.name, email: u.email, role: u.role, pinHash: hashPin(u.email, u.pin) }); log(d, 'User added', u.name + ' (' + u.role + ')'); save()
    },
    remove: async (id) => {
      needAdmin()
      const d = db(), u = d.users.find((x) => x.id === id)
      if (u.role === 'Admin' && d.users.filter((x) => x.role === 'Admin').length < 2) fail('You need at least one Admin.')
      d.users = d.users.filter((x) => x.id !== id); log(d, 'User removed', u.name); save()
    },
    verifyPin: async (id, pin) => {
      const d = db(), u = d.users.find((x) => x.id === id)
      const ok = !!u && u.pinHash === hashPin(u.email, pin)
      if (ok) { log(d, 'Sign in', u.name + ' signed in', actor.outletId, u.id); save() }
      return ok
    },
  },

  sales: {
    create: async ({ outletId, cashierId, customerId, lines, method, tendered }) => {
      const d = db()
      const priced = priceLines(lines, withCat(d))
      priced.items.forEach((i) => { if (i.productId && (row(d, i.productId, outletId)?.qty || 0) < i.qty) fail('Not enough stock for ' + i.name) })
      const cu = d.customers.find((c) => c.id === customerId)
      if (method === 'Store credit') { if (!cu || cu.credit < priced.total - 0.005) fail('Not enough store credit.'); cu.credit -= priced.total }
      let paid = priced.total
      if (method === 'Cash' && tendered != null) { if (tendered < priced.total - 0.005) fail('Cash received is less than the total.'); paid = tendered }
      priced.items.forEach((i) => { if (i.productId) row(d, i.productId, outletId).qty -= i.qty })
      if (cu) { cu.points += Math.floor(priced.total); cu.spent += priced.total }
      const number = next(d, 'sale')
      const sale = { id: 's_' + number, number, t: Date.now(), outletId, cashierId, customerId: cu ? cu.id : null, items: priced.items, subtotal: priced.subtotal, discount: priced.discount, total: priced.total, tax: priced.tax, payment: { method, tendered: paid, change: paid - priced.total }, kind: 'sale', status: 'completed' }
      d.sales.push(sale); log(d, 'Sale', `Sale #${number} ${money(priced.total)} (${method})`, outletId, cashierId); save(); return clone(sale)
    },
    refund: async (id) => {
      needAdmin()
      const d = db(), s = d.sales.find((x) => x.id === id)
      if (!s || s.status === 'refunded') fail('This sale was already refunded.')
      s.items.forEach((i) => { if (i.productId) row(d, i.productId, s.outletId).qty += i.qty })
      const cu = d.customers.find((c) => c.id === s.customerId)
      if (cu) { cu.points = Math.max(0, cu.points - Math.floor(s.total)); cu.spent = Math.max(0, cu.spent - s.total); if (s.payment.method === 'Store credit') cu.credit += s.total }
      s.status = 'refunded'; s.refundedAt = Date.now(); log(d, 'Refund', `Sale #${s.number} ${money(s.total)}`, s.outletId); save()
    },
  },

  quotes: {
    create: async ({ outletId, customerId, lines, validUntil, notes }) => {
      const d = db()
      if (!lines.length) fail('Add at least one item.')
      const p = priceLines(lines, withCat(d))
      const number = next(d, 'quote')
      const q = { id: 'q_' + number, number, t: Date.now(), outletId, createdBy: actor.userId, customerId: customerId || null, validUntil, notes: notes || '', items: p.items, subtotal: p.subtotal, discount: p.discount, total: p.total, tax: p.tax, status: 'Open' }
      d.quotes.push(q); log(d, 'Quote created', `Quote #${number} ${money(p.total)}`, outletId); save(); return clone(q)
    },
    setStatus: async (id, status) => { const d = db(), q = d.quotes.find((x) => x.id === id); q.status = status; log(d, 'Quote ' + status.toLowerCase(), 'Quote #' + q.number, q.outletId); save() },
  },

  // Special orders: items ordered in for a customer, with a deposit now and the balance on collection
  orders: {
    create: async ({ outletId, customerId, lines, expectedDate, notes, deposit, method }) => {
      const d = db()
      if (!customerId) fail('Choose a customer for a special order.')
      if (!lines.length) fail('Add at least one item.')
      const p = priceLines(lines, withCat(d))
      const dep = Number.isFinite(deposit) && deposit > 0 ? deposit : 0
      if (dep > p.total + 0.005) fail('The deposit is more than the total.')
      if (dep > 0 && !openSession(d, outletId)) fail('Open the register before taking a deposit.')
      const number = next(d, 'order')
      const o = { id: 'o_' + number, number, t: Date.now(), outletId, createdBy: actor.userId, customerId, items: p.items, subtotal: p.subtotal, discount: p.discount, total: p.total, tax: p.tax, expectedDate, notes: notes || '', status: 'Ordered', payments: dep > 0 ? [{ id: uid('pay'), t: Date.now(), type: 'deposit', method, amount: dep, outletId, userId: actor.userId }] : [] }
      d.orders.push(o); log(d, 'Special order', `Order #${number} ${money(p.total)}, deposit ${money(dep)}`, outletId); save(); return clone(o)
    },
    setStatus: async (id, status) => { const d = db(), o = d.orders.find((x) => x.id === id); o.status = status; log(d, 'Order ' + status.toLowerCase(), 'Order #' + o.number, o.outletId); save() },
    cancel: async (id) => {
      const d = db(), o = d.orders.find((x) => x.id === id)
      if (o.status === 'Completed' || o.status === 'Cancelled') fail('This order is already closed.')
      const paid = o.payments.reduce((a, p) => a + p.amount, 0)
      if (paid > 0) {
        if (!openSession(d, o.outletId)) fail('Open the register to refund the deposit.')
        o.payments.push({ id: uid('pay'), t: Date.now(), type: 'refund', method: o.payments[0].method, amount: -paid, outletId: o.outletId, userId: actor.userId })
      }
      o.status = 'Cancelled'; log(d, 'Order cancelled', `Order #${o.number}, deposit refunded ${money(paid)}`, o.outletId); save()
    },
    complete: async ({ id, method, tendered }) => {
      const d = db(), o = d.orders.find((x) => x.id === id)
      if (!o || o.status === 'Completed' || o.status === 'Cancelled') fail('This order is already closed.')
      if (!openSession(d, o.outletId)) fail('Open the register before taking payment.')
      o.items.forEach((i) => { if (i.productId && (row(d, i.productId, o.outletId)?.qty || 0) < i.qty) fail('Not enough stock for ' + i.name + '. Receive the stock first.') })
      const paidSoFar = o.payments.reduce((a, p) => a + p.amount, 0), balance = o.total - paidSoFar
      const cu = d.customers.find((c) => c.id === o.customerId)
      let paid = balance
      if (method === 'Cash' && tendered != null) { if (tendered < balance - 0.005) fail('Cash received is less than the balance.'); paid = tendered }
      if (method === 'Store credit') { if (!cu || cu.credit < balance - 0.005) fail('Not enough store credit.'); cu.credit -= balance }
      o.items.forEach((i) => { if (i.productId) row(d, i.productId, o.outletId).qty -= i.qty })
      if (cu) { cu.points += Math.floor(o.total); cu.spent += o.total }
      const number = next(d, 'sale')
      const sale = { id: 's_' + number, number, t: Date.now(), outletId: o.outletId, cashierId: actor.userId, customerId: o.customerId, items: o.items, subtotal: o.subtotal, discount: o.discount, total: o.total, tax: o.tax, payment: { method, tendered: paid, change: paid - balance }, depositApplied: paidSoFar, kind: 'order', orderId: o.id, status: 'completed' }
      d.sales.push(sale); o.status = 'Completed'; o.saleId = sale.id
      log(d, 'Order collected', `Order #${o.number} paid, sale #${number}`, o.outletId); save(); return clone(sale)
    },
  },

  holds: {
    save: async (h) => { if (!h.lines.length) fail('Nothing to hold.'); db().holds.push({ id: uid('h'), t: Date.now(), ...h }); save() },
    remove: async (id) => { const d = db(); d.holds = d.holds.filter((h) => h.id !== id); save() },
  },

  sessions: {
    // The opening float and the counted cash are both optional.
    open: async ({ outletId, userId, float }) => {
      const d = db()
      if (openSession(d, outletId)) fail('This register is already open.')
      const f = Number.isFinite(float) && float >= 0 ? float : 0
      d.sessions.push({ id: uid('r'), outletId, openedAt: Date.now(), openedBy: userId, float: f, closedAt: null })
      log(d, 'Register opened', 'Opening float ' + money(f), outletId, userId); save()
    },
    close: async ({ outletId, userId, counted }) => {
      const d = db(), s = openSession(d, outletId)
      if (!s) fail('The register is not open.')
      const summary = sessionStats(d, outletId, s.openedAt, Date.now())
      const expected = s.float + summary.tenders.Cash.v
      const c = Number.isFinite(counted) && counted >= 0 ? counted : null
      Object.assign(s, { closedAt: Date.now(), closedBy: userId, counted: c, expected, variance: c == null ? null : c - expected, summary })
      log(d, 'Register closed', 'Net sales ' + money(summary.net), outletId, userId); save(); return clone(s)
    },
  },
}
