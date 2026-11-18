import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { Btn, Drawer, Field, Input } from './ui.jsx'
import { money } from '../lib/format.js'

export function CustomerDrawer({ onClose, onSaved }) {
  const { run } = useStore()
  const [f, setF] = useState({ first: '', last: '', address: '', phone: '', email: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    const r = await run(() => api.customers.create({ ...f, first: f.first.trim(), last: f.last.trim() }))
    if (r.ok) { onSaved && onSaved(r.data); onClose() }
  }
  return (
    <Drawer title="Add customer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><Field label="First name" required value={f.first} onChange={set('first')} /><Field label="Last name" required value={f.last} onChange={set('last')} /></div>
        <Field label="Address" value={f.address} onChange={set('address')} autoComplete="street-address" />
        <div className="grid grid-cols-2 gap-3"><Field label="Phone" required value={f.phone} onChange={set('phone')} /><Field label="Email" type="email" value={f.email} onChange={set('email')} /></div>
        <div className="flex justify-end gap-2 pt-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Save customer</Btn></div>
      </form>
    </Drawer>
  )
}

// Search an existing customer by name, phone, email or address, or create a new one
export function CustomerPicker({ value, onChange }) {
  const { db } = useStore()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const c = db.customers.find((x) => x.id === value)
  if (c) return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
      <div><b>{c.name}</b><div className="text-xs text-slate-500">{c.points} pts · store credit {money(c.credit)}</div></div>
      <Btn v="soft" sm onClick={() => onChange(null)}>Change</Btn>
    </div>
  )
  const t = q.trim().toLowerCase()
  const res = t ? db.customers.filter((x) => [x.name, x.phone, x.email, x.address].join(' ').toLowerCase().includes(t)).slice(0, 5) : []
  return (
    <div className="mb-3">
      <div className="flex gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer by name, phone or email" aria-label="Search customer" /><Btn v="soft" onClick={() => setAdding(true)} className="whitespace-nowrap">+ New</Btn></div>
      {res.map((x) => <button key={x.id} onClick={() => { onChange(x.id); setQ('') }} className="mt-1 block w-full rounded-lg px-2 py-2 text-left hover:bg-slate-100">{x.name} <span className="text-sm text-slate-500">{x.phone}</span></button>)}
      {t && !res.length && <p className="mt-1 text-sm text-slate-500">No match. Use + New to add them.</p>}
      {adding && <CustomerDrawer onClose={() => setAdding(false)} onSaved={(n) => { onChange(n.id); setQ('') }} />}
    </div>
  )
}
