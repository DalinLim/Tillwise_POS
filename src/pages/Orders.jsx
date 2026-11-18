import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money, fmtDate, PAYMENTS } from '../lib/format.js'
import { Badge, Btn, Card, Drawer, H1, Input, Select, Table, Tabs } from '../components/ui.jsx'
import { OrderReceipt, Receipt, PrintButton } from '../components/Printables.jsx'

const TONE = { Ordered: 'indigo', Ready: 'amber', Completed: 'green', Cancelled: 'slate' }

function CollectDrawer({ order, onClose, onDone }) {
  const { db, run } = useStore()
  const [tendered, setTendered] = useState('')
  const paid = order.payments.reduce((a, p) => a + p.amount, 0)
  const balance = order.total - paid
  const customer = db.customers.find((c) => c.id === order.customerId)
  const tend = parseFloat(tendered)
  const pay = async (method) => {
    const r = await run(() => api.orders.complete({ id: order.id, method, tendered: method === 'Cash' && tendered !== '' ? tend : null }))
    if (r.ok) onDone(r.data)
  }
  return (
    <Drawer title={'Collect order #' + order.number} onClose={onClose}>
      <p className="mb-2 text-slate-500">{customer?.name} · {order.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</p>
      <div className="space-y-1">
        <div className="flex justify-between"><span>Order total</span><span>{money(order.total)}</span></div>
        <div className="flex justify-between"><span>Deposit paid</span><span>-{money(paid)}</span></div>
        <div className="flex justify-between border-t border-slate-200 py-2 text-2xl font-bold"><span>Balance due</span><span>{money(balance)}</span></div>
      </div>
      <label className="mt-2 block text-sm text-slate-500">Cash received (cash only)<Input type="number" step="0.05" min="0" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={balance.toFixed(2)} className="mt-1" /></label>
      <div className="my-2 flex justify-between text-slate-500"><span>Change to give back</span><b className="text-slate-900">{money(isNaN(tend) ? 0 : Math.max(0, tend - balance))}</b></div>
      <div className="grid grid-cols-2 gap-2">{PAYMENTS.map((m) => <Btn key={m} className="py-4" disabled={m === 'Store credit' && !(customer && customer.credit >= balance - 0.005)} onClick={() => pay(m)}>{m}</Btn>)}</div>
    </Drawer>
  )
}

export default function Orders({ go }) {
  const { db, run, setPending, print, autoPrint } = useStore()
  const [outlet, setOutlet] = useState('all')
  const [tab, setTab] = useState('open')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [collect, setCollect] = useState(null)
  const [done, setDone] = useState(null)
  const cname = (id) => db.customers.find((c) => c.id === id)?.name || '-'
  const oname = (id) => db.outlets.find((o) => o.id === id)?.name
  const match = (o) => (tab === 'open' ? o.status === 'Ordered' || o.status === 'Ready' : tab === 'completed' ? o.status === 'Completed' : tab === 'cancelled' ? o.status === 'Cancelled' : true)
  const list = db.orders.filter((o) => (outlet === 'all' || o.outletId === outlet) && match(o) && ('#' + o.number + ' ' + cname(o.customerId)).toLowerCase().includes(q.toLowerCase())).slice().sort((a, b) => b.t - a.t)
  const order = sel && db.orders.find((o) => o.id === sel)
  const paidOf = (o) => o.payments.reduce((a, p) => a + p.amount, 0)
  const cancel = async (o) => { if (confirm('Cancel this order and refund the deposit?')) await run(() => api.orders.cancel(o.id)) }
  const finished = (sale) => { setCollect(null); setDone(sale); if (autoPrint) print(<Receipt sale={sale} />) }
  return (
    <>
      <H1>Special orders</H1>
      <Tabs value={tab} onChange={setTab} tabs={[['open', 'Open'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['all', 'All']]} />
      <Card>
        <div className="mb-3 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order # or customer" aria-label="Search orders" />
          <Select value={outlet} onChange={(e) => setOutlet(e.target.value)} aria-label="Outlet filter"><option value="all">All outlets</option>{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
          <Btn className="whitespace-nowrap" onClick={() => { setPending({ kind: 'order', lines: [], customerId: null }); go('sale') }}>+ New special order</Btn>
        </div>
        <Table><thead><tr><th>Order</th><th>Customer</th><th>Outlet</th><th>Items</th><th className="text-right">Total</th><th className="text-right">Deposit</th><th className="text-right">Balance</th><th>Expected</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((o) => (
            <tr key={o.id}><td>#{o.number}</td><td>{cname(o.customerId)}</td><td>{oname(o.outletId)}</td><td>{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</td><td className="text-right">{money(o.total)}</td><td className="text-right">{money(paidOf(o))}</td><td className="text-right">{o.status === 'Completed' || o.status === 'Cancelled' ? '-' : money(o.total - paidOf(o))}</td><td>{o.expectedDate}</td><td><Badge tone={TONE[o.status]}>{o.status}</Badge></td>
              <td className="whitespace-nowrap"><Btn v="soft" sm onClick={() => setSel(o.id)}>Slip</Btn>
                {o.status === 'Ordered' && <> <Btn v="soft" sm onClick={() => run(() => api.orders.setStatus(o.id, 'Ready'))}>Mark ready</Btn></>}
                {(o.status === 'Ordered' || o.status === 'Ready') && <> <Btn sm onClick={() => setCollect(o.id)}>Collect</Btn> <Btn v="danger" sm onClick={() => cancel(o)}>Cancel</Btn></>}</td></tr>
          ))}{!list.length && <tr><td colSpan="10" className="text-slate-500">No orders here.</td></tr>}</tbody></Table>
      </Card>
      {order && sel && !collect && (
        <Drawer title={'Special order #' + order.number} onClose={() => setSel(null)}>
          <OrderReceipt order={order} /><div className="mt-4 flex justify-end gap-2"><PrintButton node={<OrderReceipt order={order} />} /><Btn onClick={() => setSel(null)}>Close</Btn></div>
        </Drawer>
      )}
      {collect && <CollectDrawer order={db.orders.find((o) => o.id === collect)} onClose={() => setCollect(null)} onDone={finished} />}
      {done && (
        <Drawer title="Order collected" onClose={() => setDone(null)}>
          <Receipt sale={done} /><div className="mt-4 flex justify-end gap-2"><PrintButton node={<Receipt sale={done} />} /><Btn onClick={() => setDone(null)}>Done</Btn></div>
        </Drawer>
      )}
    </>
  )
}
