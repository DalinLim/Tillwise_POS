import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money } from '../lib/format.js'
import { Btn, Card, H1, Input, Table } from '../components/ui.jsx'
import { CustomerDrawer } from '../components/CustomerForm.jsx'

export default function Customers() {
  const { db, run, toast } = useStore()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const list = db.customers.filter((c) => [c.name, c.phone, c.email, c.address].join(' ').toLowerCase().includes(q.toLowerCase()))
  const credit = async (c) => {
    const v = parseFloat(prompt('Add store credit ($):', '20'))
    if (v > 0) { const r = await run(() => api.customers.addCredit(c.id, v)); if (r.ok) toast('Added ' + money(v) + ' store credit') }
  }
  return (
    <>
      <H1>Customers</H1>
      <Card>
        <div className="mb-3 flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email or address" aria-label="Search customers" /><Btn onClick={() => setAdding(true)} className="whitespace-nowrap">Add customer</Btn></div>
        <Table><thead><tr><th>Name</th><th>Address</th><th>Phone</th><th>Email</th><th className="text-right">Points</th><th className="text-right">Credit</th><th className="text-right">Spent</th><th /></tr></thead>
          <tbody>{list.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.address}</td><td>{c.phone}</td><td>{c.email}</td><td className="text-right">{c.points}</td><td className="text-right">{money(c.credit)}</td><td className="text-right">{money(c.spent)}</td><td><Btn v="soft" sm onClick={() => credit(c)}>Add credit</Btn></td></tr>)}</tbody></Table>
        <p className="mt-3 text-sm text-slate-500">Customers earn 1 loyalty point per $1 spent.</p>
      </Card>
      {adding && <CustomerDrawer onClose={() => setAdding(false)} />}
    </>
  )
}
