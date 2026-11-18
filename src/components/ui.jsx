import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

export const cx = (...a) => a.filter(Boolean).join(' ')

const BTN = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700',
  soft: 'bg-teal-100 text-teal-800 hover:bg-teal-200',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200',
  ghost: 'border border-slate-300 bg-white hover:bg-slate-50',
}
export const Btn = ({ v = 'primary', sm, className, type = 'button', ...p }) => (
  <button type={type} {...p} className={cx('rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', sm ? 'px-3 py-1 text-sm' : 'px-4 py-2.5', BTN[v], className)} />
)
export const Card = ({ className, ...p }) => <div {...p} className={cx('rounded-2xl border border-slate-200 bg-white p-4', className)} />
export const Input = ({ className, ...p }) => <input {...p} className={cx('w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900', className)} />
export const Select = ({ className, children, ...p }) => <select {...p} className={cx('rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900', className)}>{children}</select>
export const Field = ({ label, className, ...p }) => (
  <label className={cx('block text-sm text-slate-500', className)}>{label}<Input {...p} className="mt-1" /></label>
)
const TONES = { green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-800', indigo: 'bg-indigo-100 text-indigo-800', slate: 'bg-slate-100 text-slate-700' }
export const Badge = ({ tone = 'green', children }) => <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone])}>{children}</span>
export const Kpi = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">{label}</div><div className="text-2xl font-semibold">{value}</div></div>
)
export const Kpis = ({ children }) => <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
export const H1 = ({ children }) => <h1 className="mb-4 text-2xl font-semibold">{children}</h1>
export const Table = ({ children }) => (
  <div className="overflow-x-auto"><table className="w-full text-left text-sm [&_td]:p-2 [&_td]:align-top [&_th]:p-2 [&_th]:font-medium [&_th]:text-slate-500 [&_tr]:border-b [&_tr]:border-slate-100">{children}</table></div>
)
export const Tabs = ({ tabs, value, onChange }) => (
  <div role="tablist" className="mb-4 inline-flex rounded-xl bg-slate-200 p-1">
    {tabs.map(([id, label]) => (
      <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
        className={cx('rounded-lg px-4 py-1.5 text-sm font-medium', value === id ? 'bg-white shadow' : 'text-slate-600 hover:text-slate-900')}>{label}</button>
    ))}
  </div>
)

function useEsc(onClose) {
  useEffect(() => { const f = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [onClose])
}
// Right-hand panel: 40% width and full height on desktop, full screen on phones
export function Drawer({ title, onClose, children }) {
  useEsc(onClose)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={title} className="h-screen w-full overflow-y-auto bg-white p-6 shadow-xl md:w-2/5 md:min-w-[380px] md:rounded-l-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-slate-400 hover:text-slate-700">×</button></div>
        {children}
      </aside>
    </div>
  )
}
export function Modal({ title, onClose, children }) {
  useEsc(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">{children}</div>
    </div>
  )
}

// 4-digit passcode keypad. Tap the keys or type on the keyboard.
export function PinPad({ user, onDone, onCancel }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const press = async (k) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1))
    if (pin.length >= 4) return
    const n = pin + k
    setPin(n); setErr('')
    if (n.length === 4) {
      if (await api.users.verifyPin(user.id, n)) onDone()
      else { setErr('Wrong passcode, try again.'); setTimeout(() => setPin(''), 150) }
    }
  }
  useEffect(() => {
    const f = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del') }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  })
  return (
    <>
      <h2 className="text-lg font-semibold">Switch to {user.name}</h2>
      <p className="text-sm text-slate-500">Enter your 4-digit passcode</p>
      <div className="my-4 flex justify-center gap-3" aria-label={pin.length + ' of 4 digits entered'}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-4 w-4 rounded-full border-2 border-slate-900', i < pin.length && 'bg-slate-900')} />)}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <button key={n} onClick={() => press(String(n))} className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-xl hover:bg-teal-50">{n}</button>)}
        <span /><button onClick={() => press('0')} className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-xl hover:bg-teal-50">0</button>
        <button onClick={() => press('del')} aria-label="Delete" className="rounded-xl border border-slate-200 bg-slate-50 py-3 text-xl hover:bg-teal-50">⌫</button>
      </div>
      <p role="alert" className="mb-2 min-h-5 text-sm text-red-600">{err}</p>
      <Btn v="soft" onClick={onCancel}>Cancel</Btn>
    </>
  )
}
