import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money, fmtDate, PAYMENTS, downloadCsv } from '../lib/format.js'
import { Badge, Btn, Card, Drawer, H1, Input, Select, Table } from '../components/ui.jsx'
import { Receipt, PrintButton } from '../components/Printables.jsx'

export default function History() {
  const { db, run, isAdmin } = useStore()
  const [q, setQ] = useState('')
  const [pay, setPay] = useState('all')
  const [outlet, setOutlet] = useState('all')
  const [sel, setSel] = useState(null)
  const cname = (id) => db.customers.find((c) => c.id === id)?.name || 'Walk-in'
  const uname = (id) => db.users.find((u) => u.id === id)?.name || '-'
  const oname = (id) => db.outlets.find((o) => o.id === id)?.name
  const list = db.sales.filter((s) => (pay === 'all' || s.payment.method === pay) && (outlet === 'all' || s.outletId === outlet) && ('#' + s.number + ' ' + cname(s.customerId)).toLowerCase().includes(q.toLowerCase())).slice().reverse().slice(0, 100)
  const sale = sel && db.sales.find((s) => s.id === sel)
  const refund = async () => { if (confirm('Refund this sale and return the items to stock?')) await run(() => api.sales.refund(sale.id)) }
  const exportCsv = () => downloadCsv('sales.csv', [['Sale', 'Date', 'Outlet', 'Customer', 'Cashier', 'Payment', 'Discount', 'Tax', 'Total', 'Status']].concat(list.map((s) => [s.number, new Date(s.t).toISOString(), oname(s.outletId), cname(s.customerId), uname(s.cashierId), s.payment.method, s.discount.toFixed(2), s.tax.toFixed(2), s.total.toFixed(2), s.status])))
  return (
    <>
      <H1>Sales history</H1>
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sale # or customer" aria-label="Search sales" className="!w-auto min-w-48 flex-1" />
          <Select value={pay} onChange={(e) => setPay(e.target.value)} aria-label="Payment"><option value="all">All payments</option>{PAYMENTS.map((p) => <option key={p}>{p}</option>)}</Select>
          <Select value={outlet} onChange={(e) => setOutlet(e.target.value)} aria-label="Outlet"><option value="all">All outlets</option>{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
          <Btn v="soft" onClick={exportCsv}>Export CSV</Btn>
        </div>
        <Table><thead><tr><th>Sale</th><th>Time</th><th>Outlet</th><th>Customer</th><th>Cashier</th><th>Payment</th><th className="text-right">Total</th><th /></tr></thead>
          <tbody>{list.map((s) => (
            <tr key={s.id}><td>#{s.number} {s.kind === 'order' && <Badge tone="indigo">Special order</Badge>} {s.status === 'refunded' && <Badge tone="slate">Refunded</Badge>}</td><td>{fmtDate(s.t)}</td><td>{oname(s.outletId)}</td><td>{cname(s.customerId)}</td><td>{uname(s.cashierId)}</td><td>{s.payment.method}</td><td className="text-right">{money(s.total)}</td><td><Btn v="soft" sm onClick={() => setSel(s.id)}>Receipt</Btn></td></tr>
          ))}</tbody></Table>
      </Card>
      {sale && (
        <Drawer title={'Sale #' + sale.number} onClose={() => setSel(null)}>
          <Receipt sale={sale} />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {isAdmin && sale.status !== 'refunded' && <Btn v="danger" onClick={refund}>Refund sale</Btn>}
            <PrintButton node={<Receipt sale={sale} />} /><Btn onClick={() => setSel(null)}>Close</Btn>
          </div>
        </Drawer>
      )}
    </>
  )
}
