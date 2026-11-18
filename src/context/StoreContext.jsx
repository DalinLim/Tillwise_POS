import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null)
  const [outletId, setOutletIdState] = useState(() => sessionStorage.getItem('tillwise-active-outlet') || null)
  const setOutletId = (id) => { if (id) sessionStorage.setItem('tillwise-active-outlet', id); else sessionStorage.removeItem('tillwise-active-outlet'); setOutletIdState(id) }
  const [userId, setUserId] = useState('u1')
  const [autoPrint, setAutoPrint] = useState(true)
  const [toastMsg, setToastMsg] = useState(null)
  const [printNode, setPrintNode] = useState(null)
  const [pending, setPending] = useState(null) // cart handed to the Sale screen (quote -> sale, new quote, new special order)

  useEffect(() => { api.snapshot().then(setDb) }, [])
  useEffect(() => { if (printNode) window.print() }, [printNode])
  useEffect(() => {
    const done = () => setPrintNode(null)
    window.addEventListener('afterprint', done)
    return () => window.removeEventListener('afterprint', done)
  }, [])
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 2600); return () => clearTimeout(t) }, [toastMsg])

  if (!db) return null
  const toast = (m, bad) => setToastMsg({ m, bad })
  // run(): call the data layer, then refresh the snapshot. Returns { ok, data }.
  const me = db.users.find((u) => u.id === userId) || db.users[0]
  const run = async (fn) => {
    try { api.setActor({ userId: me.id, outletId, role: me.role }); const data = await fn(); setDb(await api.snapshot()); return { ok: true, data } }
    catch (e) { toast(e.message, true); return { ok: false } }
  }
  const value = {
    db, run, toast, me, isAdmin: me.role === 'Admin', outletId, setOutletId, outlet: db.outlets.find((o) => o.id === outletId) || null,
    setUserId, autoPrint, setAutoPrint, pending, setPending, print: (node) => setPrintNode(node),
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div role="status" className={'fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-white shadow-lg md:bottom-6 ' + (toastMsg.bad ? 'bg-red-600' : 'bg-slate-900')}>{toastMsg.m}</div>}
      {printNode && <div className="hidden print:block">{printNode}</div>}
    </Ctx.Provider>
  )
}
