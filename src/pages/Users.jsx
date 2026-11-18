import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { Badge, Btn, Card, Drawer, Field, H1, Select, Table } from '../components/ui.jsx'

function UserDrawer({ onClose }) {
  const { run } = useStore()
  const [f, setF] = useState({ name: '', email: '', pin: '', role: 'Cashier' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => { e.preventDefault(); const r = await run(() => api.users.create(f)); if (r.ok) onClose() }
  return (
    <Drawer title="Add user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name" required value={f.name} onChange={set('name')} />
        <Field label="Email" type="email" required value={f.email} onChange={set('email')} />
        <Field label="4-digit passcode" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} title="4 digits" required autoComplete="new-password" value={f.pin} onChange={set('pin')} />
        <label className="block text-sm text-slate-500">Role<Select value={f.role} onChange={set('role')} className="mt-1 w-full"><option>Cashier</option><option>Admin</option></Select></label>
        <div className="flex justify-end gap-2"><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Save user</Btn></div>
      </form>
    </Drawer>
  )
}

export default function Users() {
  const { db, me, isAdmin, run } = useStore()
  const [adding, setAdding] = useState(false)
  if (!isAdmin) return <><H1>Users</H1><Card>Only an Admin can manage users. Switch to an Admin using the Cashier menu.</Card></>
  const remove = async (u) => { if (confirm('Delete ' + u.name + '?')) await run(() => api.users.remove(u.id)) }
  return (
    <>
      <H1>Users</H1>
      <Card>
        <div className="mb-3"><Btn onClick={() => setAdding(true)}>Add user</Btn></div>
        <Table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>{db.users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><Badge tone="indigo">{u.role}</Badge></td><td className="text-right">{u.id !== me.id && <Btn v="danger" sm onClick={() => remove(u)}>Delete</Btn>}</td></tr>)}</tbody></Table>
        <p className="mt-3 text-sm text-slate-500">Switching cashier asks for that user’s 4-digit passcode. Demo passcode for the sample users: 1234. This is a front-end demo, so passcodes are not real security.</p>
      </Card>
      {adding && <UserDrawer onClose={() => setAdding(false)} />}
    </>
  )
}
