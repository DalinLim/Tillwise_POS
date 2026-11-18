import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money, startOfDay, dayKey } from '../lib/format.js'
import { liveSales, stockStatus, qtyOf } from '../lib/reports.js'
import { Badge, Btn, Card, H1, Kpi, Kpis, Select } from '../components/ui.jsx'

const PERIODS = { today: 'Today', yesterday: 'Yesterday', 7: 'Last 7 days', 30: 'Last 30 days' }

function Bars({ data, money: isMoney }) {
  const e = Object.entries(data).sort((a, b) => b[1] - a[1])
  const m = Math.max(...e.map((x) => x[1]), 1)
  if (!e.length) return <p className="text-slate-500">No sales in this period.</p>
  return e.map(([k, v]) => (
    <div key={k} className="mb-2"><div className="flex justify-between text-sm text-slate-500"><span>{k}</span><b className="text-slate-900">{isMoney ? money(v) : v}</b></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-teal-600" style={{ width: (v / m) * 100 + '%' }} /></div></div>
  ))
}

export default function Dashboard() {
  const { db, run } = useStore()
  const [period, setPeriod] = useState('today')
  const [outletId, setOutletId] = useState('all')
  const t0 = startOfDay(Date.now())
  const [from, to] = period === 'today' ? [t0, Infinity] : period === 'yesterday' ? [t0 - 864e5, t0] : [Date.now() - Number(period) * 864e5, Infinity]
  const inOutlet = (s) => outletId === 'all' || s.outletId === outletId
  const list = liveSales(db).filter((s) => s.t >= from && s.t < to && inOutlet(s))
  let revenue = 0, tax = 0, cost = 0
  const byBrand = {}, byPay = {}, top = {}
  list.forEach((s) => {
    revenue += s.total; tax += s.tax; byPay[s.payment.method] = (byPay[s.payment.method] || 0) + s.total
    s.items.forEach((i) => { cost += i.cost * i.qty; byBrand[i.category] = (byBrand[i.category] || 0) + i.net; top[i.name] = (top[i.name] || 0) + i.qty })
  })
  const days = []
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: dayKey(d), l: d.getDate(), v: 0 }) }
  liveSales(db).filter(inOutlet).forEach((s) => { const x = days.find((d) => d.k === dayKey(s.t)); if (x) x.v += s.total })
  const mx = Math.max(...days.map((d) => d.v), 1)
  const top5 = Object.fromEntries(Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5))
  return (
    <>
      <H1>Dashboard</H1>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">{Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select value={outletId} onChange={(e) => setOutletId(e.target.value)} aria-label="Outlet"><option value="all">All outlets</option>{db.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
        <Btn v="danger" onClick={() => confirm('Reset to demo data?') && run(() => api.reset())}>Reset demo data</Btn>
      </div>
      <Kpis><Kpi label={'Sales · ' + PERIODS[period]} value={money(revenue)} /><Kpi label="Transactions" value={list.length} /><Kpi label="Average basket" value={money(list.length ? revenue / list.length : 0)} /><Kpi label="Gross profit" value={money(revenue - tax - cost)} /></Kpis>
      <Card className="mb-4"><h2 className="mb-2 text-lg font-semibold">Sales, last 14 days</h2>
        <svg viewBox="0 0 560 185" width="100%" role="img" aria-label="Sales for the last 14 days">
          {days.map((d, i) => <g key={d.k}><rect x={i * 40 + 6} y={150 - (d.v / mx) * 140} width="28" height={(d.v / mx) * 140} rx="5" fill="#0d9488"><title>{money(d.v)}</title></rect><text x={i * 40 + 20} y="172" fontSize="12" textAnchor="middle" fill="#64748b">{d.l}</text></g>)}
        </svg></Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-3 text-lg font-semibold">Sales by category</h2><Bars data={byBrand} money /></Card>
        <Card><h2 className="mb-3 text-lg font-semibold">Payment methods</h2><Bars data={byPay} money /><h2 className="mb-3 mt-5 text-lg font-semibold">Top products (units)</h2><Bars data={top5} /></Card>
      </div>
      <Card className="mt-4"><h2 className="mb-3 text-lg font-semibold">Low and out of stock</h2>
        {(() => {
          const outs = outletId === 'all' ? db.outlets : db.outlets.filter((o) => o.id === outletId)
          const items = db.products.filter((p) => outs.some((o) => qtyOf(db, p.id, o.id) <= p.reorderLevel)).slice(0, 8)
          if (!items.length) return <p className="text-slate-500">Everything is well stocked.</p>
          return items.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1.5 text-sm"><span>{p.name}</span>
              <span className="flex gap-2">{outs.map((o) => <Badge key={o.id} tone={stockStatus(qtyOf(db, p.id, o.id), p.reorderLevel).tone}>{o.name}: {qtyOf(db, p.id, o.id)}</Badge>)}</span></div>
          ))
        })()}</Card>
    </>
  )
}
