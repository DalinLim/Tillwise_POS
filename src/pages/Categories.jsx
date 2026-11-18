import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { Btn, Card, Input, Table } from '../components/ui.jsx'

// Sale categories (brands). Only an Admin can add or remove them; every product must belong to one.
export default function Categories() {
  const { db, run, isAdmin } = useStore()
  const [name, setName] = useState('')
  const add = async (e) => { e.preventDefault(); const r = await run(() => api.categories.add(name)); if (r.ok) setName('') }
  return (
    <Card>
      {isAdmin
        ? <form onSubmit={add} className="mb-3 flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Tom Ford" aria-label="New category name" /><Btn type="submit" className="whitespace-nowrap">+ Add category</Btn></form>
        : <p className="mb-3 text-sm text-slate-500">Only an Admin can add or remove categories.</p>}
      <Table><thead><tr><th>Category</th><th className="text-right">Products</th><th /></tr></thead>
        <tbody>{db.categories.map((c) => {
          const n = db.products.filter((p) => p.categoryId === c.id).length
          return <tr key={c.id}><td>{c.name}</td><td className="text-right">{n}</td><td className="text-right">{isAdmin && <Btn v="danger" sm onClick={() => run(() => api.categories.remove(c.id))}>Delete</Btn>}</td></tr>
        })}</tbody></Table>
      <p className="mt-3 text-sm text-slate-500">When an Admin creates a product, they choose its category from this list. The Sale screen shows these as the filter buttons.</p>
    </Card>
  )
}
