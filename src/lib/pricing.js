import { TAX_DIV } from './format.js'

// lines: [{ lineId, productId, custom?: { name, price, cost }, qty, dt: '%' | '$', dv }]
// Custom lines are items that are not in the catalogue (repairs, engraving, prescription lenses...).
// products must carry a `category` name (the api and context add it).
export function priceLines(lines, products) {
  const items = lines.map((l) => {
    const p = l.custom
      ? { id: null, sku: 'CUSTOM', name: l.custom.name, category: 'Custom', price: l.custom.price, cost: l.custom.cost || 0 }
      : products.find((x) => x.id === l.productId)
    const gross = p.price * l.qty
    const discount = l.dt === '%' ? (gross * Math.min(l.dv || 0, 100)) / 100 : Math.min(l.dv || 0, gross)
    return { lineId: l.lineId || l.productId, productId: p.id, sku: p.sku, name: p.name, category: p.category, custom: !!l.custom, qty: l.qty, price: p.price, cost: p.cost, dt: l.dt, dv: l.dv || 0, discount, net: gross - discount }
  })
  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0)
  const discount = items.reduce((a, i) => a + i.discount, 0)
  const total = subtotal - discount
  return { items, subtotal, discount, total, tax: total / TAX_DIV }
}

// turn saved items (from a quote or order) back into editable cart lines
export const itemsToLines = (items) =>
  items.map((i) => ({ lineId: i.lineId, productId: i.productId, custom: i.custom ? { name: i.name, price: i.price, cost: i.cost } : undefined, qty: i.qty, dt: i.dt, dv: i.dv }))
