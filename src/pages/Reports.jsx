import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { money, fmtDate, startOfDay, iso, downloadCsv, PAYMENTS } from '../lib/format.js'
import { inventoryRows, salesReport, stockStatus, liveSales, inRange } from '../lib/reports.js'
import { Badge, Btn, Card, H1, Input, Kpi, Kpis, Select, Table, Tabs } from '../components/ui.jsx'
import { ReportSheet } from '../components/Printables.jsx'

const GROUPS = { day: 'Day', category: 'Category', product: 'Product', cashier: 'Cashier', payment: 'Payment type', customer: 'Customer' }
const label = (cls, text, child) => <label className={'text-sm text-slate-500 ' + cls}>{text}{child}</label>

// Shared filter bar pieces
function useRange() {
  const [from, setFrom] = useState(iso(Date.now() - 6 * 864e5))
  const [to, setTo] = useState(iso(Date.now()))
  const ui = (<>
    {label('', 'From', <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />)}
    {label('', 'To', <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />)}
  </>)
  return { from, to, ui }
}
const OutletSelect = ({ db, value, onChange }) => label('', 'Outlet', <Select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block"><option value="all">All outlets</option>{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>)
const Actions = ({ onCsv, onPrint }) => <><Btn v="soft" onClick={onCsv}>Export CSV</Btn><Btn v="soft" onClick={onPrint}>Print</Btn></>
const DataTable = ({ head, body, foot, right = [] }) => (
  <Table><thead><tr>{head.map((h, i) => <th key={h} className={right.includes(i) ? 'text-right' : ''}>{h}</th>)}</tr></thead>
    <tbody>{body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={right.includes(j) ? 'text-right' : ''}>{c}</td>)}</tr>)}
      {!body.length && <tr><td colSpan={head.length} className="text-slate-500">Nothing to show for these filters.</td></tr>}
      {foot && <tr className="font-bold">{foot.map((c, j) => <td key={j} className={right.includes(j) ? 'text-right' : ''}>{c}</td>)}</tr>}</tbody></Table>
)

function TodayReport() {
  const { db } = useStore()
  const [outlet, setOutlet] = useState('all')
  const t0 = startOfDay(Date.now())
  const list = liveSales(db).filter((s) => s.t >= t0 && (outlet === 'all' || s.outletId === outlet))
  const all = db.sales.filter((s) => s.t >= t0 && (outlet === 'all' || s.outletId === outlet)).sort((a, b) => b.t - a.t)
  let revenue = 0, tax = 0, cost = 0, units = 0
  const byPay = {}, hours = Array.from({ length: 13 }, (_, i) => ({ h: i + 8, v: 0 }))
  list.forEach((s) => {
    revenue += s.total; tax += s.tax; byPay[s.payment.method] = (byPay[s.payment.method] || 0) + s.total
    s.items.forEach((i) => { cost += i.cost * i.qty; units += i.qty })
    const h = hours.find((x) => x.h === new Date(s.t).getHours()); if (h) h.v += s.total
  })
  const mx = Math.max(...hours.map((x) => x.v), 1)
  const cname = (id) => db.customers.find((c) => c.id === id)?.name || 'Walk-in'
  return (
    <>
      <Tabs value={outlet} onChange={setOutlet} tabs={[['all', 'All outlets'], ...db.outlets.map((o) => [o.id, o.name])]} />
      <Kpis><Kpi label="Sales today" value={money(revenue)} /><Kpi label="Transactions" value={list.length} /><Kpi label="Average basket" value={money(list.length ? revenue / list.length : 0)} /><Kpi label="Gross profit" value={money(revenue - tax - cost)} /></Kpis>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-2 text-lg font-semibold">Sales by hour</h2>
          <svg viewBox="0 0 520 170" width="100%" role="img" aria-label="Sales by hour today">
            {hours.map((x, i) => <g key={x.h}><rect x={i * 40 + 6} y={140 - (x.v / mx) * 120} width="28" height={(x.v / mx) * 120} rx="4" fill="#0d9488"><title>{money(x.v)}</title></rect><text x={i * 40 + 20} y="160" fontSize="11" textAnchor="middle" fill="#64748b">{x.h}</text></g>)}
          </svg></Card>
        <Card><h2 className="mb-2 text-lg font-semibold">By outlet and payment</h2>
          <Table><thead><tr><th>Outlet</th><th className="text-right">Sales</th><th className="text-right">Net</th></tr></thead>
            <tbody>{db.outlets.filter((o) => outlet === 'all' || o.id === outlet).map((o) => { const l = list.filter((s) => s.outletId === o.id); return <tr key={o.id}><td>{o.name}</td><td className="text-right">{l.length}</td><td className="text-right">{money(l.reduce((a, s) => a + s.total, 0))}</td></tr> })}</tbody></Table>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">{PAYMENTS.map((p) => <div key={p} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span>{p}</span><b>{money(byPay[p] || 0)}</b></div>)}</div></Card>
      </div>
      <Card><h2 className="mb-2 text-lg font-semibold">Today’s transactions</h2>
        <DataTable right={[5]} head={['Sale', 'Time', 'Outlet', 'Customer', 'Payment', 'Total']}
          body={all.slice(0, 15).map((s) => [`#${s.number}${s.status === 'refunded' ? ' (refunded)' : ''}`, fmtDate(s.t), db.outlets.find((o) => o.id === s.outletId).name, cname(s.customerId), s.payment.method, money(s.total)])} /></Card>
    </>
  )
}

function SalesReport() {
  const { db, print } = useStore()
  const { from, to, ui } = useRange()
  const [outletId, setOutletId] = useState('all')
  const [groupBy, setGroupBy] = useState('day')
  const { rows, total } = salesReport(db, { from, to, outletId, groupBy })
  const sub = `${from} to ${to} · ${outletId === 'all' ? 'All outlets' : db.outlets.find((o) => o.id === outletId).name}`
  const head = [GROUPS[groupBy], 'Orders', 'Units', 'Net sales', 'Tax', 'Gross profit']
  const body = rows.map((r) => [r.k, r.orders, r.units, money(r.net), money(r.tax), money(r.profit)])
  const foot = ['Total', total.orders, total.units, money(total.net), money(total.tax), money(total.profit)]
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">{ui}<OutletSelect db={db} value={outletId} onChange={setOutletId} />
        {label('', 'Group by', <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="mt-1 block">{Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>)}
        <Actions onCsv={() => downloadCsv('sales-report.csv', [head, ...body, foot])} onPrint={() => print(<ReportSheet title={'Sales report by ' + GROUPS[groupBy].toLowerCase()} sub={sub} head={head} rows={body} foot={foot} />)} /></div>
      <Kpis><Kpi label="Net sales" value={money(total.net)} /><Kpi label="Orders" value={total.orders} /><Kpi label="Tax included" value={money(total.tax)} /><Kpi label="Gross profit" value={money(total.profit)} /></Kpis>
      <DataTable head={head} body={body} foot={foot} right={[1, 2, 3, 4, 5]} />
    </Card>
  )
}

function TransactionsReport() {
  const { db, print } = useStore()
  const { from, to, ui } = useRange()
  const [outletId, setOutletId] = useState('all')
  const [pay, setPay] = useState('all')
  const [user, setUser] = useState('all')
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const cname = (id) => db.customers.find((c) => c.id === id)?.name || 'Walk-in'
  const uname = (id) => db.users.find((u) => u.id === id)?.name || '-'
  const oname = (id) => db.outlets.find((o) => o.id === id)?.name
  const list = db.sales.filter((s) => inRange(s.t, from, to) && (outletId === 'all' || s.outletId === outletId) && (pay === 'all' || s.payment.method === pay) && (user === 'all' || s.cashierId === user) && (kind === 'all' || s.kind === kind) && ('#' + s.number + ' ' + cname(s.customerId) + ' ' + s.items.map((i) => i.name).join(' ')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.t - a.t)
  const live = list.filter((s) => s.status !== 'refunded')
  const head = ['Sale', 'Time', 'Outlet', 'Type', 'Cashier', 'Customer', 'Items', 'Payment', 'Total', 'Status']
  const body = list.slice(0, 300).map((s) => [s.number, fmtDate(s.t), oname(s.outletId), s.kind === 'order' ? 'Special order' : 'Sale', uname(s.cashierId), cname(s.customerId), s.items.reduce((a, i) => a + i.qty, 0), s.payment.method, money(s.total), s.status === 'refunded' ? 'Refunded' : 'Completed'])
  const foot = ['Total', '', '', '', '', '', live.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0), '', money(live.reduce((a, s) => a + s.total, 0)), live.length + ' sales']
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">{ui}<OutletSelect db={db} value={outletId} onChange={setOutletId} />
        {label('', 'Payment', <Select value={pay} onChange={(e) => setPay(e.target.value)} className="mt-1 block"><option value="all">All</option>{PAYMENTS.map((p) => <option key={p}>{p}</option>)}</Select>)}
        {label('', 'Cashier', <Select value={user} onChange={(e) => setUser(e.target.value)} className="mt-1 block"><option value="all">All</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>)}
        {label('', 'Type', <Select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 block"><option value="all">All</option><option value="sale">Sale</option><option value="order">Special order</option></Select>)}
        {label('min-w-40 flex-1', 'Search', <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sale #, customer or item" className="mt-1" />)}
        <Actions onCsv={() => downloadCsv('transactions.csv', [head, ...body, foot])} onPrint={() => print(<ReportSheet title="Sales transactions" sub={`${from} to ${to}`} head={head} rows={body} foot={foot} />)} /></div>
      <DataTable head={head} body={body} foot={foot} right={[6, 8]} />
    </Card>
  )
}

function InventoryReport() {
  const { db, print } = useStore()
  const [outlet, setOutlet] = useState('all')
  const [q, setQ] = useState('')
  const rows = inventoryRows(db, outlet, q)
  const units = rows.reduce((a, r) => a + r.total, 0)
  const cost = rows.reduce((a, r) => a + r.costValue, 0)
  const retail = rows.reduce((a, r) => a + r.retailValue, 0)
  const flagged = rows.filter((r) => r.shown.some((id) => r.qty[id] <= r.product.reorderLevel)).length
  const shownIds = outlet === 'all' ? db.outlets.map((o) => o.id) : [outlet]
  const name = (id) => db.outlets.find((o) => o.id === id).name
  const head = ['Product number', 'Product', 'Category', ...shownIds.map((id) => name(id) + ' on hand'), 'Total', 'Cost value', 'Retail value', 'Status']
  const body = rows.map((r) => [r.product.sku, r.product.name, r.product.category, ...r.shown.map((id) => r.qty[id]), r.total, money(r.costValue), money(r.retailValue), stockStatus(r.total, r.product.reorderLevel).label])
  const foot = ['Total', '', '', ...shownIds.map((id) => rows.reduce((a, r) => a + r.qty[id], 0)), units, money(cost), money(retail), '']
  const sub = (outlet === 'all' ? 'All outlets' : name(outlet)) + (q ? ' · search: ' + q : '')
  return (
    <Card>
      <Tabs value={outlet} onChange={setOutlet} tabs={[['all', 'All outlets'], ...db.outlets.map((o) => [o.id, o.name])]} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by brand name or product number" aria-label="Search inventory report" className="!w-auto min-w-60 flex-1" />
        <Actions onCsv={() => downloadCsv('inventory-report.csv', [head, ...body, foot])} onPrint={() => print(<ReportSheet title="Inventory report" sub={sub} head={head} rows={body} foot={foot} />)} />
      </div>
      <Kpis><Kpi label="Products" value={rows.length} /><Kpi label="Units on hand" value={units} /><Kpi label="Stock value (cost)" value={money(cost)} /><Kpi label="Low or out of stock" value={flagged} /></Kpis>
      <Table><thead><tr>{head.map((h, i) => <th key={h} className={i > 2 && i < head.length - 1 ? 'text-right' : ''}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => {
          const st = stockStatus(r.total, r.product.reorderLevel)
          return <tr key={r.product.id}><td>{r.product.sku}</td><td>{r.product.name}</td><td>{r.product.category}</td>{r.shown.map((id) => <td key={id} className="text-right">{r.qty[id]}</td>)}<td className="text-right">{r.total}</td><td className="text-right">{money(r.costValue)}</td><td className="text-right">{money(r.retailValue)}</td><td><Badge tone={st.tone}>{st.label}</Badge></td></tr>
        })}{!rows.length && <tr><td colSpan="9" className="text-slate-500">No products match.</td></tr>}</tbody></Table>
    </Card>
  )
}

function PurchasesReport() {
  const { db, print } = useStore()
  const { from, to, ui } = useRange()
  const [outletId, setOutletId] = useState('all')
  const [q, setQ] = useState('')
  const uname = (id) => db.users.find((u) => u.id === id)?.name || '-'
  const oname = (id) => db.outlets.find((o) => o.id === id)?.name
  const list = db.purchases.filter((p) => p.date >= from && p.date <= to && (outletId === 'all' || p.outletId === outletId) && (p.supplier + ' ' + p.invoiceNo + ' ' + p.items.map((i) => i.name + ' ' + i.sku).join(' ')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.t - a.t)
  const head = ['Invoice date', 'Received', 'Outlet', 'Supplier / factory', 'Invoice', 'Units', 'Total cost', 'Received by']
  const body = list.map((p) => [p.date, fmtDate(p.t), oname(p.outletId), p.supplier, p.invoiceNo, p.items.reduce((a, i) => a + i.qty, 0), money(p.total), uname(p.receivedBy)])
  const foot = ['Total', '', '', '', '', list.reduce((a, p) => a + p.items.reduce((x, i) => x + i.qty, 0), 0), money(list.reduce((a, p) => a + p.total, 0)), '']
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">{ui}<OutletSelect db={db} value={outletId} onChange={setOutletId} />
        {label('min-w-40 flex-1', 'Search', <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Supplier, invoice, product or number" className="mt-1" />)}
        <Actions onCsv={() => downloadCsv('purchases-report.csv', [head, ...body, foot])} onPrint={() => print(<ReportSheet title="Stock received" sub={`${from} to ${to}`} head={head} rows={body} foot={foot} />)} /></div>
      <DataTable head={head} body={body} foot={foot} right={[5, 6]} />
    </Card>
  )
}

function ActivityReport() {
  const { db, print } = useStore()
  const { from, to, ui } = useRange()
  const [outletId, setOutletId] = useState('all')
  const [user, setUser] = useState('all')
  const [type, setType] = useState('all')
  const [q, setQ] = useState('')
  const uname = (id) => db.users.find((u) => u.id === id)?.name || 'Removed user'
  const oname = (id) => db.outlets.find((o) => o.id === id)?.name || '-'
  const types = [...new Set(db.activity.map((a) => a.type))].sort()
  const list = db.activity.filter((a) => inRange(a.t, from, to) && (outletId === 'all' || a.outletId === outletId) && (user === 'all' || a.userId === user) && (type === 'all' || a.type === type) && (a.type + ' ' + a.detail).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.t - a.t)
  const head = ['Time', 'User', 'Outlet', 'Action', 'Detail']
  const body = list.slice(0, 400).map((a) => [fmtDate(a.t), uname(a.userId), oname(a.outletId), a.type, a.detail])
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end gap-3">{ui}<OutletSelect db={db} value={outletId} onChange={setOutletId} />
        {label('', 'User', <Select value={user} onChange={(e) => setUser(e.target.value)} className="mt-1 block"><option value="all">All users</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>)}
        {label('', 'Action', <Select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 block"><option value="all">All actions</option>{types.map((t) => <option key={t}>{t}</option>)}</Select>)}
        {label('min-w-40 flex-1', 'Search', <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the detail" className="mt-1" />)}
        <Actions onCsv={() => downloadCsv('activity.csv', [head, ...body])} onPrint={() => print(<ReportSheet title="User activity" sub={`${from} to ${to}`} head={head} rows={body} />)} /></div>
      <p className="mb-2 text-sm text-slate-500">{list.length} actions. Showing the newest 400.</p>
      <DataTable head={head} body={body} />
    </Card>
  )
}

const TABS = [['today', 'Today'], ['sales', 'Sales'], ['transactions', 'Transactions'], ['inventory', 'Inventory'], ['purchases', 'Purchases'], ['activity', 'User activity']]
const VIEWS = { today: TodayReport, sales: SalesReport, transactions: TransactionsReport, inventory: InventoryReport, purchases: PurchasesReport, activity: ActivityReport }

export default function Reports() {
  const { isAdmin } = useStore()
  const [tab, setTab] = useState('today')
  if (!isAdmin) return <><H1>Reporting</H1><Card>Only an Admin can view reports. Switch to an Admin using the Cashier menu.</Card></>
  const View = VIEWS[tab]
  return (
    <>
      <H1>Reporting</H1>
      <p className="mb-3 text-sm text-slate-500">Every report can show Sydney, Phnom Penh or both, whichever outlet you are working in.</p>
      <Tabs value={tab} onChange={setTab} tabs={TABS} />
      <View />
    </>
  )
}
