import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { inventoryRows, stockStatus, qtyOf } from '../lib/reports.js'
import { Badge, Btn, Card, Drawer, Field, H1, Input, Select, Table, Tabs } from '../components/ui.jsx'

function AdjustDrawer({ product, onClose }) {
  const { db, run } = useStore()
  const [lv, setLv] = useState(() => Object.fromEntries(db.outlets.map((o) => [o.id, qtyOf(db, product.id, o.id)])))
  const submit = async (e) => { e.preventDefault(); const r = await run(() => api.stock.set({ productId: product.id, levels: Object.fromEntries(Object.entries(lv).map(([k, v]) => [k, +v])) })); if (r.ok) onClose() }
  return (
    <Drawer title="Adjust stock" onClose={onClose}>
      <p className="mb-3 text-slate-500">{product.name}</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">{db.outlets.map((o) => <Field key={o.id} label={o.name} type="number" min="0" required value={lv[o.id]} onChange={(e) => setLv({ ...lv, [o.id]: e.target.value })} />)}</div>
        <div className="flex justify-end gap-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Save</Btn></div>
      </form>
    </Drawer>
  )
}

function TransferDrawer({ product, onClose }) {
  const { db, me, run } = useStore()
  const [from, setFrom] = useState(db.outlets[0].id)
  const [to, setTo] = useState(db.outlets[1].id)
  const [qty, setQty] = useState('1')
  const submit = async (e) => { e.preventDefault(); const r = await run(() => api.stock.transfer({ productId: product.id, from, to, qty: +qty, userId: me.id })); if (r.ok) onClose() }
  return (
    <Drawer title="Transfer stock" onClose={onClose}>
      <p className="mb-3 text-slate-500">{product.name}</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm text-slate-500">From<Select value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full">{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({qtyOf(db, product.id, o.id)} on hand)</option>)}</Select></label>
        <label className="block text-sm text-slate-500">To<Select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full">{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></label>
        <Field label="Quantity" type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} />
        <div className="flex justify-end gap-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Transfer</Btn></div>
      </form>
    </Drawer>
  )
}

export default function Inventory() {
  const { db, isAdmin } = useStore()
  const [outlet, setOutlet] = useState('all') // 'all' or an outlet id
  const [q, setQ] = useState('')
  const [low, setLow] = useState(false)
  const [panel, setPanel] = useState(null) // { kind: 'adjust' | 'transfer', product }
  const rows = inventoryRows(db, outlet, q).filter((r) => !low || r.shown.some((id) => r.qty[id] <= r.product.reorderLevel))
  const outletName = (id) => db.outlets.find((o) => o.id === id).name
  return (
    <>
      <H1>Inventory</H1>
      <Tabs value={outlet} onChange={setOutlet} tabs={[['all', 'All outlets'], ...db.outlets.map((o) => [o.id, o.name])]} />
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by brand, product name or product number" aria-label="Search inventory" className="!w-auto min-w-60 flex-1" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Low or out of stock only</label>
        </div>
        <Table>
          <thead><tr><th>Product number</th><th>Product</th><th>Category</th>{(outlet === 'all' ? db.outlets.map((o) => o.id) : [outlet]).map((id) => <th key={id} className="text-right">{outletName(id)} on hand</th>)}<th>{outlet === 'all' ? 'Total' : 'Status'}</th>{isAdmin && <th />}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product.id}>
                <td>{r.product.sku}</td><td>{r.product.name}</td><td>{r.product.category}</td>
                {r.shown.map((id) => <td key={id} className="text-right"><Badge tone={stockStatus(r.qty[id], r.product.reorderLevel).tone}>{r.qty[id]}</Badge></td>)}
                <td>{outlet === 'all' ? r.total : <Badge tone={stockStatus(r.total, r.product.reorderLevel).tone}>{stockStatus(r.total, r.product.reorderLevel).label}</Badge>}</td>
                {isAdmin && <td className="whitespace-nowrap"><Btn v="soft" sm onClick={() => setPanel({ kind: 'adjust', product: r.product })}>Adjust</Btn> <Btn v="soft" sm onClick={() => setPanel({ kind: 'transfer', product: r.product })}>Transfer</Btn></td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="8" className="text-slate-500">No products match.</td></tr>}
          </tbody>
        </Table>
      </Card>
      {panel?.kind === 'adjust' && <AdjustDrawer product={panel.product} onClose={() => setPanel(null)} />}
      {panel?.kind === 'transfer' && <TransferDrawer product={panel.product} onClose={() => setPanel(null)} />}
    </>
  )
}
