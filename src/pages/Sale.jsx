import { useEffect, useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { priceLines } from '../lib/pricing.js'
import { money, dayKey, fmtDate, iso, addDays, PAYMENTS } from '../lib/format.js'
import { qtyOf, openSession } from '../lib/reports.js'
import { Btn, Card, Drawer, Field, H1, Input, Select, Tabs, cx } from '../components/ui.jsx'
import { CustomerPicker } from '../components/CustomerForm.jsx'
import { Receipt, QuoteDoc, OrderReceipt, PrintButton } from '../components/Printables.jsx'
import ProductIcon from '../components/ProductIcon.jsx'

const Totals = ({ p }) => (
  <div className="mt-3 space-y-1 text-slate-500">
    <div className="flex justify-between"><span>Subtotal</span><span>{money(p.subtotal)}</span></div>
    <div className="flex justify-between"><span>Discounts</span><span>-{money(p.discount)}</span></div>
    <div className="flex justify-between"><span>Tax included</span><span>{money(p.tax)}</span></div>
    <div className="flex justify-between py-2 text-2xl font-bold text-slate-900"><span>Total</span><span>{money(p.total)}</span></div>
  </div>
)

// An item that is not in the catalogue: a repair, engraving, prescription lenses...
function CustomDrawer({ onAdd, onClose }) {
  const [f, setF] = useState({ name: '', price: '', cost: '', qty: '1' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = (e) => { e.preventDefault(); onAdd({ name: f.name.trim(), price: +f.price, cost: +f.cost || 0 }, Math.max(1, +f.qty || 1)); onClose() }
  return (
    <Drawer title="Custom item" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">Add something that is not in the product list. It does not change stock.</p>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Description" required autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Prescription lenses, repair, engraving" />
        <div className="grid grid-cols-3 gap-3"><Field label="Price incl. tax" type="number" step="0.01" min="0" required value={f.price} onChange={set('price')} /><Field label="Cost (optional)" type="number" step="0.01" min="0" value={f.cost} onChange={set('cost')} /><Field label="Quantity" type="number" min="1" value={f.qty} onChange={set('qty')} /></div>
        <div className="flex justify-end gap-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Add to sale</Btn></div>
      </form>
    </Drawer>
  )
}

function QuoteDrawer({ lines, customerId, total, onDone, onClose }) {
  const { outletId, run } = useStore()
  const [validUntil, setValid] = useState(iso(addDays(Date.now(), 14)))
  const [notes, setNotes] = useState('')
  const submit = async (e) => { e.preventDefault(); const r = await run(() => api.quotes.create({ outletId, customerId, lines, validUntil, notes })); if (r.ok) onDone(r.data) }
  return (
    <Drawer title="Save quote" onClose={onClose}>
      <p className="mb-3 text-slate-500">Quote total <b className="text-slate-900">{money(total)}</b>. Nothing is charged and stock is not reserved.</p>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Valid until" type="date" required value={validUntil} onChange={(e) => setValid(e.target.value)} />
        <label className="block text-sm text-slate-500">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
        <div className="flex justify-end gap-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Save and print quote</Btn></div>
      </form>
    </Drawer>
  )
}

function OrderDrawer({ lines, customerId, total, onDone, onClose }) {
  const { outletId, run } = useStore()
  const [expected, setExpected] = useState(iso(addDays(Date.now(), 14)))
  const [notes, setNotes] = useState('')
  const [deposit, setDeposit] = useState(String(Math.round(total / 2)))
  const [method, setMethod] = useState('Cash')
  const submit = async (e) => {
    e.preventDefault()
    const r = await run(() => api.orders.create({ outletId, customerId, lines, expectedDate: expected, notes, deposit: parseFloat(deposit), method }))
    if (r.ok) onDone(r.data)
  }
  return (
    <Drawer title="Create special order" onClose={onClose}>
      <p className="mb-3 text-slate-500">Order total <b className="text-slate-900">{money(total)}</b>. The customer pays a deposit now and the balance when they collect.</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><Field label="Deposit ($)" type="number" step="0.01" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} /><label className="block text-sm text-slate-500">Deposit paid by<Select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full">{['Cash', 'Card', 'Amex'].map((m) => <option key={m}>{m}</option>)}</Select></label></div>
        <Field label="Expected date" type="date" required value={expected} onChange={(e) => setExpected(e.target.value)} />
        <label className="block text-sm text-slate-500">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" placeholder="Colour, size, supplier..." /></label>
        <div className="flex justify-end gap-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Create order</Btn></div>
      </form>
    </Drawer>
  )
}

export default function Sale({ go }) {
  const { db, me, outletId, outlet, run, toast, autoPrint, print, pending, setPending } = useStore()
  const [kind, setKind] = useState('sale') // sale | order | quote
  const [lines, setLines] = useState([]) // [{ lineId, productId?, custom?, qty, dt, dv }]
  const [customerId, setCustomerId] = useState(null)
  const [mode, setMode] = useState('shop') // shop | pay | done
  const [openLine, setOpenLine] = useState(null)
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [code, setCode] = useState('')
  const [tendered, setTendered] = useState('')
  const [last, setLast] = useState(null)
  const [panel, setPanel] = useState(null) // custom | quote | order | holds
  const [doc, setDoc] = useState(null) // { type: 'quote' | 'order', data }

  useEffect(() => {
    if (!pending) return
    setLines(pending.lines || []); setCustomerId(pending.customerId || null); setKind(pending.kind || 'sale'); setMode('shop'); setPending(null)
  }, [pending, setPending])

  const session = openSession(db, outletId)
  const registerOk = session && dayKey(session.openedAt) === dayKey(Date.now())
  const priced = priceLines(lines, db.products)
  const customer = db.customers.find((c) => c.id === customerId)
  const holds = db.holds.filter((h) => h.outletId === outletId)
  const title = { sale: 'Sale', order: 'Special order', quote: 'Quote' }[kind]

  const add = (p) => {
    const cur = lines.find((l) => l.lineId === p.id)?.qty || 0
    const have = qtyOf(db, p.id, outletId)
    if (kind === 'sale' && cur + 1 > have) return toast(`Only ${have} left at ${outlet.name}`, true)
    setLines(cur ? lines.map((l) => (l.lineId === p.id ? { ...l, qty: cur + 1 } : l)) : [...lines, { lineId: p.id, productId: p.id, qty: 1, dt: '%', dv: 0 }])
  }
  const addCustom = (c, qty) => setLines([...lines, { lineId: 'c_' + Date.now(), custom: c, qty, dt: '%', dv: 0 }])
  const dec = (id) => setLines(lines.flatMap((l) => (l.lineId !== id ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [])))
  const patch = (id, x) => setLines(lines.map((l) => (l.lineId === id ? { ...l, ...x } : l)))
  const inc = (l) => (l.custom ? patch(l.lineId, { qty: l.qty + 1 }) : add(db.products.find((p) => p.id === l.productId)))
  const reset = () => { setLines([]); setCustomerId(null); setOpenLine(null); setTendered('') }

  // Type a barcode, product number, name or category. Enter adds the exact barcode match, or the first suggestion.
  const t = code.trim().toLowerCase()
  const matches = t ? db.products.filter((p) => (p.sku + ' ' + p.name + ' ' + p.category).toLowerCase().includes(t)).slice(0, 6) : []
  const onCodeKey = (e) => {
    if (e.key !== 'Enter') return
    const m = db.products.find((p) => p.sku === code.trim()) || matches[0]
    if (m) { add(m); setCode('') } else if (t) toast('No product with code ' + code, true)
  }
  const cats = ['All', ...db.categories.map((c) => c.name)]
  const tiles = db.products.filter((p) => (cat === 'All' || p.category === cat) && (p.name + ' ' + p.sku).toLowerCase().includes(q.toLowerCase()))

  const pay = async (method) => {
    const r = await run(() => api.sales.create({ outletId, cashierId: me.id, customerId, lines, method, tendered: method === 'Cash' && tendered !== '' ? parseFloat(tendered) : null }))
    if (!r.ok) return
    setLast(r.data); reset(); setMode('done')
    if (autoPrint) print(<Receipt sale={r.data} />)
  }
  const hold = async () => { const r = await run(() => api.holds.save({ outletId, cashierId: me.id, customerId, lines })); if (r.ok) { reset(); toast('Sale put on hold') } }
  const resume = async (h) => { setLines(h.lines); setCustomerId(h.customerId); setPanel(null); await run(() => api.holds.remove(h.id)) }
  const documentDone = (type, data) => {
    setPanel(null); reset(); setDoc({ type, data })
    if (autoPrint) print(type === 'quote' ? <QuoteDoc quote={data} /> : <OrderReceipt order={data} />)
  }

  const tend = parseFloat(tendered)
  const change = isNaN(tend) ? 0 : Math.max(0, tend - priced.total)
  const canCredit = customer && customer.credit >= priced.total - 0.005

  const cart = (
    <Card>
      <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Current {kind === 'sale' ? 'sale' : kind === 'order' ? 'order' : 'quote'}</h2>
        {mode === 'shop' && kind === 'sale' && <Btn v="ghost" sm onClick={() => setPanel('holds')}>Held sales ({holds.length})</Btn>}</div>
      {mode === 'shop' ? <CustomerPicker value={customerId} onChange={setCustomerId} /> : customer && <p className="mb-2 text-sm text-slate-500">Customer: <b>{customer.name}</b></p>}
      {!priced.items.length && <p className="my-3 text-slate-500">Scan a barcode or tap a product to start.</p>}
      <ul>
        {priced.items.map((it) => {
          const l = lines.find((x) => x.lineId === it.lineId)
          const isOpen = openLine === it.lineId && mode === 'shop'
          return (
            <li key={it.lineId} className="border-b border-slate-100 py-2">
              <div className="flex items-start gap-2">
                {mode === 'shop' ? (
                  <button className="flex-1 text-left" aria-expanded={isOpen} onClick={() => setOpenLine(isOpen ? null : it.lineId)}>
                    <span className="font-semibold">{it.name}</span>{it.custom && <span className="ml-1 rounded bg-indigo-100 px-1.5 text-xs text-indigo-700">Custom</span>}<br />
                    <span className="text-sm text-slate-500">{it.discount ? <><s>{money(it.price)}</s> {money(it.price - it.discount / it.qty)} each · {l.dt === '%' ? l.dv + '%' : money(l.dv)} off</> : <>{money(it.price)} each · tap to add a discount</>}</span>
                  </button>
                ) : <div className="flex-1">{it.name}{it.discount > 0 && <div className="text-sm text-slate-500">Discount -{money(it.discount)}</div>}</div>}
                {mode === 'shop' ? (
                  <div className="flex items-center gap-1">
                    <button aria-label="Remove one" onClick={() => dec(it.lineId)} className="h-7 w-7 rounded border border-slate-300">−</button>
                    <span className="w-5 text-center">{it.qty}</span>
                    <button aria-label="Add one" onClick={() => inc(l)} className="h-7 w-7 rounded border border-slate-300">+</button>
                  </div>
                ) : <span>× {it.qty}</span>}
                <div className="w-20 text-right">{money(it.net)}</div>
              </div>
              {isOpen && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-teal-50 p-2">
                  <Input autoFocus type="number" min="0" step="0.5" value={l.dv || ''} placeholder="Discount" aria-label={'Discount for ' + it.name} onChange={(e) => patch(it.lineId, { dv: parseFloat(e.target.value) || 0 })} className="!w-24 !py-1" />
                  <select value={l.dt} aria-label="Discount type" onChange={(e) => patch(it.lineId, { dt: e.target.value })} className="rounded border border-slate-300 px-2 py-1"><option value="%">%</option><option value="$">$</option></select>
                  <span className="text-sm">Price after discount: <b>{money(it.net)}</b></span>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <Totals p={priced} />
      {mode === 'shop' && (
        <div className="space-y-2">
          {kind === 'sale' && <Btn className="w-full" disabled={!lines.length} onClick={() => setMode('pay')}>Charge {money(priced.total)}</Btn>}
          {kind === 'order' && <Btn className="w-full" disabled={!lines.length || !customerId} onClick={() => setPanel('order')}>{customerId ? 'Create special order' : 'Choose a customer first'}</Btn>}
          {kind === 'quote' && <Btn className="w-full" disabled={!lines.length} onClick={() => setPanel('quote')}>Save quote</Btn>}
          {!!lines.length && <div className="flex gap-2">{kind === 'sale' && <Btn v="soft" className="flex-1" onClick={hold}>Hold sale</Btn>}<Btn v="danger" className="flex-1" onClick={reset}>Clear</Btn></div>}
        </div>
      )}
    </Card>
  )

  return (
    <>
      <H1>{title}</H1>
      <Tabs value={kind} onChange={(k) => { setKind(k); setMode('shop') }} tabs={[['sale', 'Sale'], ['order', 'Special order'], ['quote', 'Quote']]} />
      {kind === 'order' && <p className="mb-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">Special order: stock is not checked. Choose the customer, add what they want (use Custom item for anything not listed), then take a deposit. They pay the balance when they collect it under Special orders.</p>}
      {kind === 'quote' && <p className="mb-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">Quote: nothing is charged and stock is not reserved. You can turn a saved quote into a sale later from the Quotes page.</p>}

      {kind === 'sale' && !registerOk ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Register is closed</h2>
          <p className="mb-4 text-slate-500">{session ? 'This register was opened on a previous day. Close it, then open it again to start today.' : 'Open the register for ' + outlet.name + ' before you start selling.'}</p>
          <Btn onClick={() => go('register')}>Go to Register</Btn>
        </Card>
      ) : mode === 'shop' ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="relative min-w-40 flex-1">
                <Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onCodeKey} placeholder="Scan or type a product code" aria-label="Scan or type a product code" autoFocus autoComplete="off" />
                {!!matches.length && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {matches.map((p) => <li key={p.id}><button onClick={() => { add(p); setCode('') }} className="flex w-full justify-between px-3 py-2 text-left hover:bg-teal-50"><span>{p.name}<span className="block text-xs text-slate-500">{p.sku}</span></span><b className="text-teal-700">{money(p.price)}</b></button></li>)}
                  </ul>
                )}
              </div>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sunglasses" aria-label="Search sunglasses" className="!w-auto min-w-40 flex-1" />
              <Btn v="soft" onClick={() => setPanel('custom')} className="whitespace-nowrap">+ Custom item</Btn>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {cats.map((b) => <button key={b} onClick={() => setCat(b)} className={cx('rounded-full border px-3 py-1 text-sm', cat === b ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white')}>{b}</button>)}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {tiles.map((p) => {
                const have = qtyOf(db, p.id, outletId)
                return (
                  <button key={p.id} onClick={() => add(p)} className={cx('flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-teal-500', have < 1 && kind === 'sale' && 'opacity-45')}>
                    <ProductIcon color={p.color} /><span className="text-sm">{p.name}</span><b className="text-teal-700">{money(p.price)}</b><small className="text-slate-500">{have} in stock</small>
                  </button>
                )
              })}
              {!tiles.length && <p className="text-slate-500">No products found.</p>}
            </div>
          </Card>
          <div className="lg:col-span-2">{cart}</div>
        </div>
      ) : mode === 'pay' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {cart}
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Take payment</h2>
            <div className="flex justify-between py-2 text-2xl font-bold"><span>Total due</span><span>{money(priced.total)}</span></div>
            <label className="block text-sm text-slate-500">Cash received (cash only)
              <Input autoFocus type="number" min="0" step="0.05" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={priced.total.toFixed(2)} className="mt-1" /></label>
            <div className="my-2 flex justify-between text-slate-500"><span>Change to give back</span><b className="text-slate-900">{money(change)}</b></div>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENTS.map((m) => <Btn key={m} className="py-4" disabled={m === 'Store credit' && !canCredit} onClick={() => pay(m)}>{m}</Btn>)}
            </div>
            <p className="mt-3 text-sm text-slate-500">{customer ? `${customer.name} has ${money(customer.credit)} store credit.` : 'Add a customer to use store credit.'}</p>
            <Btn v="soft" className="mt-3" onClick={() => setMode('shop')}>Back to sale</Btn>
          </Card>
        </div>
      ) : last && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><h2 className="text-lg font-semibold">Sale complete</h2><p className="my-2 text-slate-500">Sale #{last.number} · {money(last.total)}</p><Btn className="w-full" onClick={() => setMode('shop')}>Start new sale</Btn></Card>
          <Card><Receipt sale={last} /><div className="mt-3 flex justify-end"><Btn v="soft" onClick={() => print(<Receipt sale={last} />)}>Print receipt</Btn></div></Card>
        </div>
      )}

      {panel === 'custom' && <CustomDrawer onAdd={addCustom} onClose={() => setPanel(null)} />}
      {panel === 'quote' && <QuoteDrawer lines={lines} customerId={customerId} total={priced.total} onClose={() => setPanel(null)} onDone={(d) => documentDone('quote', d)} />}
      {panel === 'order' && <OrderDrawer lines={lines} customerId={customerId} total={priced.total} onClose={() => setPanel(null)} onDone={(d) => documentDone('order', d)} />}
      {panel === 'holds' && (
        <Drawer title="Held sales" onClose={() => setPanel(null)}>
          {!holds.length && <p className="text-slate-500">No sales on hold at {outlet.name}.</p>}
          {holds.map((h) => {
            const p = priceLines(h.lines, db.products)
            return (
              <div key={h.id} className="mb-3 rounded-xl border border-slate-200 p-3">
                <div className="text-sm text-slate-500">{fmtDate(h.t)} · {db.customers.find((c) => c.id === h.customerId)?.name || 'Walk-in'}</div>
                <div>{p.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</div>
                <div className="mt-2 flex items-center justify-between"><b>{money(p.total)}</b>
                  <div className="flex gap-2"><Btn sm onClick={() => resume(h)}>Resume</Btn><Btn v="danger" sm onClick={() => run(() => api.holds.remove(h.id))}>Delete</Btn></div></div>
              </div>
            )
          })}
        </Drawer>
      )}
      {doc && (
        <Drawer title={doc.type === 'quote' ? 'Quote #' + doc.data.number : 'Special order #' + doc.data.number} onClose={() => setDoc(null)}>
          {doc.type === 'quote' ? <QuoteDoc quote={doc.data} /> : <OrderReceipt order={doc.data} />}
          <div className="mt-4 flex justify-end gap-2"><PrintButton node={doc.type === 'quote' ? <QuoteDoc quote={doc.data} /> : <OrderReceipt order={doc.data} />} /><Btn onClick={() => setDoc(null)}>Done</Btn></div>
        </Drawer>
      )}
    </>
  )
}
