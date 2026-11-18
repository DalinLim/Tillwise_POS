import { useEffect, useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { Modal, PinPad, Select, cx } from './ui.jsx'

export const NAV = [['sale', 'Sale'], ['register', 'Register'], ['history', 'Sales history'], ['orders', 'Special orders'], ['quotes', 'Quotes'], ['products', 'Products'], ['inventory', 'Inventory'], ['customers', 'Customers'], ['users', 'Users'], ['reports', 'Reporting'], ['dashboard', 'Dashboard']]

export default function Layout({ page, setPage, children }) {
  const { db, me, outletId, outlet, setUserId, autoPrint, setAutoPrint, toast } = useStore()
  const [pinFor, setPinFor] = useState(null)
  const [now, setNow] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i) }, [])
  return (
    <div className="min-h-screen md:flex print:hidden">
      <aside className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto bg-slate-950 p-1.5 md:sticky md:top-0 md:h-screen md:w-52 md:flex-none md:flex-col md:gap-1 md:p-3">
        <div className="hidden px-3 pb-4 text-xl font-bold text-white md:block">Tillwise<span className="text-teal-400">.</span></div>
        {NAV.map(([id, label]) => (
          <button key={id} onClick={() => { if (outletId || id === 'register') setPage(id) }} disabled={!outletId && id !== 'register'} aria-current={page === id ? 'page' : undefined}
            className={cx('flex-none whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium', page === id ? 'bg-teal-600 text-white' : !outletId ? 'cursor-not-allowed text-slate-600' : 'text-slate-300 hover:bg-slate-800')}>{label}</button>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5 text-sm md:px-6">
          <div className="flex items-center gap-2"><span className="text-slate-500">Active outlet</span><span className="rounded-lg bg-teal-50 px-3 py-2 font-semibold text-teal-800">{outlet?.name || 'Not selected'}</span></div>
          <label className="flex items-center gap-2">Cashier
            <Select value={me.id} onChange={(e) => e.target.value !== me.id && setPinFor(db.users.find((u) => u.id === e.target.value))}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={autoPrint} onChange={(e) => setAutoPrint(e.target.checked)} /> Auto-print receipts</label>
          <span className="text-slate-500 md:ml-auto">{now.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </header>
        <main className="mx-auto max-w-6xl p-4 pb-24 md:p-6">{children}</main>
      </div>
      {pinFor && (
        <Modal title="Enter passcode" onClose={() => setPinFor(null)}>
          <PinPad user={pinFor} onCancel={() => setPinFor(null)} onDone={() => { setUserId(pinFor.id); toast('Signed in as ' + pinFor.name); setPinFor(null) }} />
        </Modal>
      )}
    </div>
  )
}
