import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money, fmtDate, iso, downloadCsv } from '../lib/format.js'
import { Btn, Card, Drawer, Field, Input, Select, Table } from '../components/ui.jsx'
import { PurchaseDoc, PrintButton } from '../components/Printables.jsx'

// Receive stock from a supplier / factory against an invoice. Anyone can do this.
function ReceiveDrawer({ onClose }) {
  const { db, outletId, run, toast, print, autoPrint } = useStore()
  const outlet = outletId
  const [date, setDate] = useState(iso(Date.now()))
  const [supplier, setSupplier] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([]) // [{ productId, qty, unitCost }]
  const [code, setCode] = useState('')
  const t = code.trim().toLowerCase()
  const matches = t ? db.products.filter((p) => (p.sku + ' ' + p.name + ' ' + p.category).toLowerCase().includes(t)).slice(0, 6) : []
  const add = (p) => {
    setLines((ls) => (ls.some((l) => l.productId === p.id) ? ls.map((l) => (l.productId === p.id ? { ...l, qty: +l.qty + 1 } : l)) : [...ls, { productId: p.id, qty: 1, unitCost: String(p.cost) }]))
  }
  const onKey = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const m = db.products.find((p) => p.sku === code.trim()) || matches[0]
    if (m) { add(m); setCode('') } else if (t) toast('No product with code ' + code, true)
  }
  const patch = (id, x) => setLines(lines.map((l) => (l.productId === id ? { ...l, ...x } : l)))
  const total = lines.reduce((a, l) => a + (+l.qty || 0) * (parseFloat(l.unitCost) || 0), 0)
  const submit = async (e) => {
    e.preventDefault()
    const r = await run(() => api.purchases.receive({ outletId: outlet, date, supplier, invoiceNo, notes, lines: lines.map((l) => ({ productId: l.productId, qty: +l.qty, unitCost: parseFloat(l.unitCost) })) }))
    if (r.ok) { toast('Stock received into ' + db.outlets.find((o) => o.id === outlet).name); if (autoPrint) print(<PurchaseDoc purchase={r.data} />); onClose() }
  }
  const suppliers = [...new Set(db.purchases.map((p) => p.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const supplierMatches = suppliers.filter((name) => name.toLowerCase().includes(supplier.trim().toLowerCase()))
  const exactSupplier = suppliers.some((name) => name.toLowerCase() === supplier.trim().toLowerCase())
  return (
    <Drawer title="Receive stock" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label="Invoice number" required value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </div>
        <div className="relative">
          <label className="mb-1 block text-sm font-medium text-slate-600">Supplier / factory <span className="text-rose-500">*</span></label>
          <div className={`flex items-center rounded-xl border bg-white transition focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 ${supplierOpen ? 'border-teal-500' : 'border-slate-200'}`}>
            <span className="pl-3 text-slate-400" aria-hidden="true">⌕</span>
            <input
              required
              value={supplier}
              onChange={(e) => { setSupplier(e.target.value); setSupplierOpen(true) }}
              onFocus={() => setSupplierOpen(true)}
              onBlur={() => window.setTimeout(() => setSupplierOpen(false), 140)}
              autoComplete="off"
              placeholder="Search or enter a supplier name"
              aria-label="Search or enter supplier"
              aria-expanded={supplierOpen}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
            {supplier && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSupplier(''); setSupplierOpen(true) }} className="px-2 text-slate-400 hover:text-slate-700" aria-label="Clear supplier">×</button>}
            <span className="pr-3 text-xs text-slate-400" aria-hidden="true">▾</span>
          </div>
          {supplierOpen && (
            <div className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
              {supplier.trim() && !exactSupplier && (
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSupplier(supplier.trim()); setSupplierOpen(false) }} className="mb-1 flex w-full items-center gap-2 rounded-lg bg-teal-50 px-3 py-2.5 text-left text-sm text-teal-800 hover:bg-teal-100">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-base">＋</span>
                  <span><span className="block font-semibold">Use “{supplier.trim()}”</span><span className="text-xs text-teal-700">Add as a new supplier for this purchase</span></span>
                </button>
              )}
              {supplierMatches.map((name) => (
                <button key={name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSupplier(name); setSupplierOpen(false) }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 ${supplier === name ? 'bg-slate-50' : ''}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">▤</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{name}</span>
                  {supplier === name && <span className="text-teal-600">✓</span>}
                </button>
              ))}
              {!supplierMatches.length && !supplier.trim() && <p className="px-3 py-4 text-center text-sm text-slate-500">No previous suppliers yet. Type a name to add one.</p>}
              {supplier.trim() && exactSupplier && !supplierMatches.length && <p className="px-3 py-3 text-sm text-slate-500">No matching supplier found.</p>}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-400">Choose a previous supplier or type a new name.</p>
        </div>
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">Receiving stock into <b>{db.outlets.find((o) => o.id === outlet)?.name}</b></p>
        <div className="relative">
          <label className="block text-sm text-slate-500">Scan or type a product code
            <Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} autoComplete="off" placeholder="Scan a barcode, or type a code, name or brand" className="mt-1" /></label>
          {!!matches.length && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {matches.map((p) => <li key={p.id}><button type="button" onClick={() => { add(p); setCode('') }} className="flex w-full justify-between px-3 py-2 text-left hover:bg-teal-50"><span>{p.name}<span className="block text-xs text-slate-500">{p.sku}</span></span><span className="text-xs text-slate-500">Retail {money(p.price)}</span></button></li>)}
            </ul>
          )}
        </div>
        {lines.length > 0 && (
          <Table><thead><tr><th>Product</th><th className="text-right">Retail</th><th className="text-right">Wholesale</th><th>Unit cost</th><th>Qty</th><th className="text-right">Line</th><th /></tr></thead>
            <tbody>{lines.map((l) => {
              const p = db.products.find((x) => x.id === l.productId)
              return (
                <tr key={l.productId}><td>{p.name}<div className="text-xs text-slate-500">{p.sku}</div></td><td className="text-right">{money(p.price)}</td><td className="text-right">{money(p.wholesale)}</td>
                  <td><Input type="number" step="0.01" min="0" aria-label={'Unit cost for ' + p.name} value={l.unitCost} onChange={(e) => patch(l.productId, { unitCost: e.target.value })} className="!w-20 !px-2 !py-1" /></td>
                  <td><Input type="number" min="1" aria-label={'Quantity for ' + p.name} value={l.qty} onChange={(e) => patch(l.productId, { qty: e.target.value })} className="!w-16 !px-2 !py-1" /></td>
                  <td className="text-right">{money((+l.qty || 0) * (parseFloat(l.unitCost) || 0))}</td>
                  <td><button type="button" aria-label={'Remove ' + p.name} onClick={() => setLines(lines.filter((x) => x !== l))} className="text-slate-400 hover:text-red-600">×</button></td></tr>
              )
            })}</tbody></Table>
        )}
        <label className="block text-sm text-slate-500">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
        <div className="flex items-center justify-between"><b>Total cost {money(total)}</b><div className="flex gap-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Receive into stock</Btn></div></div>
      </form>
    </Drawer>
  )
}

export default function Purchases() {
  const { db } = useStore()
  const [outlet, setOutlet] = useState('all')
  const [q, setQ] = useState('')
  const [receiving, setReceiving] = useState(false)
  const [sel, setSel] = useState(null)
  const oname = (id) => db.outlets.find((o) => o.id === id)?.name
  const uname = (id) => db.users.find((u) => u.id === id)?.name || '-'
  const list = db.purchases.filter((p) => (outlet === 'all' || p.outletId === outlet) && (p.supplier + ' ' + p.invoiceNo).toLowerCase().includes(q.toLowerCase())).slice().sort((a, b) => b.t - a.t)
  const sale = sel && db.purchases.find((p) => p.id === sel)
  const exportCsv = () => downloadCsv('purchases.csv', [['Receipt', 'Invoice date', 'Received', 'Outlet', 'Supplier', 'Invoice', 'Units', 'Total cost', 'Received by']].concat(list.map((p) => [p.number, p.date, new Date(p.t).toISOString(), oname(p.outletId), p.supplier, p.invoiceNo, p.items.reduce((a, i) => a + i.qty, 0), p.total.toFixed(2), uname(p.receivedBy)])))
  return (
    <>
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search supplier or invoice number" aria-label="Search purchases" className="!w-auto min-w-48 flex-1" />
          <Select value={outlet} onChange={(e) => setOutlet(e.target.value)} aria-label="Outlet"><option value="all">All outlets</option>{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
          <Btn v="soft" onClick={exportCsv}>Export CSV</Btn>
          <Btn onClick={() => setReceiving(true)}>+ Receive stock</Btn>
        </div>
        <Table><thead><tr><th>Invoice date</th><th>Received</th><th>Outlet</th><th>Supplier / factory</th><th>Invoice</th><th className="text-right">Units</th><th className="text-right">Total cost</th><th>By</th><th /></tr></thead>
          <tbody>{list.map((p) => <tr key={p.id}><td>{p.date}</td><td>{fmtDate(p.t)}</td><td>{oname(p.outletId)}</td><td>{p.supplier}</td><td>{p.invoiceNo}</td><td className="text-right">{p.items.reduce((a, i) => a + i.qty, 0)}</td><td className="text-right">{money(p.total)}</td><td>{uname(p.receivedBy)}</td><td><Btn v="soft" sm onClick={() => setSel(p.id)}>View</Btn></td></tr>)}
            {!list.length && <tr><td colSpan="9" className="text-slate-500">No stock receipts yet.</td></tr>}</tbody></Table>
      </Card>
      {receiving && <ReceiveDrawer onClose={() => setReceiving(false)} />}
      {sale && (
        <Drawer title={'Stock received #' + sale.number} onClose={() => setSel(null)}>
          <PurchaseDoc purchase={sale} /><div className="mt-4 flex justify-end gap-2"><PrintButton node={<PurchaseDoc purchase={sale} />} /><Btn onClick={() => setSel(null)}>Close</Btn></div>
        </Drawer>
      )}
    </>
  )
}
