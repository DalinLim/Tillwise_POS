import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money, fmtDate, iso } from '../lib/format.js'
import { itemsToLines } from '../lib/pricing.js'
import { Badge, Btn, Card, Drawer, H1, Input, Select, Table } from '../components/ui.jsx'
import { QuoteDoc, PrintButton } from '../components/Printables.jsx'

const TONE = { Open: 'indigo', Accepted: 'green', Converted: 'green', Declined: 'slate', Expired: 'amber' }

export default function Quotes({ go }) {
  const { db, run, setPending } = useStore()
  const [outlet, setOutlet] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const cname = (id) => db.customers.find((c) => c.id === id)?.name || '-'
  const status = (x) => (x.status === 'Open' && x.validUntil < iso(Date.now()) ? 'Expired' : x.status)
  const list = db.quotes.filter((x) => (outlet === 'all' || x.outletId === outlet) && ('#' + x.number + ' ' + cname(x.customerId)).toLowerCase().includes(q.toLowerCase())).slice().sort((a, b) => b.t - a.t)
  const quote = sel && db.quotes.find((x) => x.id === sel)
  const convert = async (x) => { setPending({ kind: 'sale', lines: itemsToLines(x.items), customerId: x.customerId }); await run(() => api.quotes.setStatus(x.id, 'Converted')); go('sale') }
  return (
    <>
      <H1>Quotes</H1>
      <Card>
        <div className="mb-3 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quote # or customer" aria-label="Search quotes" />
          <Select value={outlet} onChange={(e) => setOutlet(e.target.value)} aria-label="Outlet filter"><option value="all">All outlets</option>{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
          <Btn className="whitespace-nowrap" onClick={() => { setPending({ kind: 'quote', lines: [], customerId: null }); go('sale') }}>+ New quote</Btn>
        </div>
        <Table><thead><tr><th>Quote</th><th>Date</th><th>Outlet</th><th>Customer</th><th>Valid until</th><th className="text-right">Total</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((x) => {
            const st = status(x)
            return (
              <tr key={x.id}><td>#{x.number}</td><td>{fmtDate(x.t)}</td><td>{db.outlets.find((o) => o.id === x.outletId)?.name || '-'}</td><td>{cname(x.customerId)}</td><td>{x.validUntil}</td><td className="text-right">{money(x.total)}</td><td><Badge tone={TONE[st]}>{st}</Badge></td>
                <td className="whitespace-nowrap"><Btn v="soft" sm onClick={() => setSel(x.id)}>View</Btn>{(st === 'Open' || st === 'Accepted') && <> <Btn sm onClick={() => convert(x)}>Convert to sale</Btn></>}</td></tr>
            )
          })}{!list.length && <tr><td colSpan="8" className="text-slate-500">No quotes yet. Use + New quote, or Save quote from the Sale screen.</td></tr>}</tbody></Table>
      </Card>
      {quote && (
        <Drawer title={'Quote #' + quote.number} onClose={() => setSel(null)}>
          <QuoteDoc quote={quote} />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {status(quote) === 'Open' && <><Btn v="danger" onClick={() => run(() => api.quotes.setStatus(quote.id, 'Declined'))}>Mark declined</Btn><Btn v="soft" onClick={() => run(() => api.quotes.setStatus(quote.id, 'Accepted'))}>Mark accepted</Btn></>}
            <PrintButton node={<QuoteDoc quote={quote} />} /><Btn onClick={() => setSel(null)}>Close</Btn>
          </div>
        </Drawer>
      )}
    </>
  )
}
