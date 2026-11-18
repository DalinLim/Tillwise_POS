import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money, fmtDate, dayKey, PAYMENTS } from '../lib/format.js'
import { openSession, sessionStats } from '../lib/reports.js'
import { Badge, Btn, Card, Drawer, Field, H1, Kpi, Kpis, Table } from '../components/ui.jsx'
import { CloseReport, PrintButton } from '../components/Printables.jsx'

export default function Register() {
  const { db, me, outletId, setOutletId, run, print, autoPrint, toast } = useStore()
  const [opening, setOpening] = useState(null) // outlet id being opened
  const [closing, setClosing] = useState(null) // outlet id being closed
  const [float, setFloat] = useState('')
  const [counted, setCounted] = useState('')
  const [report, setReport] = useState(null)
  const name = (id) => db.users.find((u) => u.id === id)?.name || '-'
  const oname = (id) => db.outlets.find((o) => o.id === id).name

  const info = (oid) => {
    const s = openSession(db, oid)
    return { s, stale: s && dayKey(s.openedAt) !== dayKey(Date.now()), st: s ? sessionStats(db, oid, s.openedAt, Date.now()) : null }
  }
  const open = async (e) => {
    e.preventDefault()
    const r = await run(() => api.sessions.open({ outletId: opening, userId: me.id, float: parseFloat(float) }))
    if (r.ok) { setOutletId(opening); toast('Register opened at ' + oname(opening) + '. You are now selling at ' + oname(opening) + '.'); setOpening(null); setFloat('') }
  }
  const close = async (e) => {
    e.preventDefault()
    const r = await run(() => api.sessions.close({ outletId: closing, userId: me.id, counted: parseFloat(counted) }))
    if (r.ok) { setClosing(null); setCounted(''); setReport(r.data); if (autoPrint) print(<CloseReport session={r.data} />) }
  }

  const v = outletId ? info(outletId) : { s: null, stale: false, st: null }
  const expected = v.s ? v.s.float + v.st.tenders.Cash.v : 0
  const history = db.sessions.filter((x) => x.outletId === outletId && x.closedAt).sort((a, b) => b.closedAt - a.closedAt)
  const cl = closing ? info(closing) : null
  const clExpected = cl && cl.s ? cl.s.float + cl.st.tenders.Cash.v : 0

  if (!outletId) return (
    <>
      <H1>Open a register</H1>
      <p className="mb-5 text-slate-500">Choose the outlet you are working at. All new sales, quotes, special orders, payments and stock activity will be recorded under this outlet.</p>
      <div className="grid gap-4 sm:grid-cols-2">{db.outlets.map((o) => (
        <Card key={o.id}>
          <h2 className="mb-2 text-xl font-semibold">{o.name}</h2>
          <p className="mb-4 text-sm text-slate-500">Open this outlet's register to start working.</p>
          <Btn className="w-full" onClick={() => { if (openSession(db, o.id)) setOutletId(o.id); else setOpening(o.id) }}>Select {o.name}</Btn>
        </Card>
      ))}</div>
      {opening && <Drawer title={'Open ' + oname(opening) + ' register'} onClose={() => setOpening(null)}>
        <form className="space-y-3" onSubmit={open}><Field label="Opening cash float" type="number" min="0" step="0.01" required value={float} onChange={(e) => setFloat(e.target.value)} /><div className="flex justify-end gap-2"><Btn v="soft" type="button" onClick={() => { setOpening(null); setOutletId(null) }}>Cancel</Btn><Btn type="submit">Open register</Btn></div></form>
      </Drawer>}
    </>
  )

  return (
    <>
      <H1>Registers</H1>
      <p className="mb-4 text-sm text-slate-500">You are selling at <b>{oname(outletId)}</b>. Only this outlet's register is shown here.</p>
      {(() => {
        const x = info(outletId)
        const o = db.outlets.find((item) => item.id === outletId)
        return (
          <Card className="mb-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{o.name} register</h2>{x.s ? <Badge>Open</Badge> : <Badge tone="slate">Closed</Badge>}</div>
            {x.s ? <>
              <p className="text-sm text-slate-500">Opened by {name(x.s.openedBy)} · {fmtDate(x.s.openedAt)}</p>
              <p className="my-2 text-2xl font-semibold">{money(x.st.net)} <span className="text-sm font-normal text-slate-500">net sales · {x.st.count} sales</span></p>
              {x.stale && <p className="text-sm text-red-600">Opened on a previous day. Close it, then open it again.</p>}
              <div className="mt-2 flex gap-2"><Btn sm onClick={() => setClosing(outletId)}>Close register</Btn></div>
            </> : <>
              <p className="my-2 text-slate-500">The {o.name} register is not open. Open it before making sales.</p>
              <div className="flex gap-2"><Btn onClick={() => setOpening(outletId)}>Open register</Btn><Btn v="soft" onClick={() => setOutletId(null)}>Choose another outlet</Btn></div>
            </>}
          </Card>
        )
      })()}
      {v.s ? (
        <>
          <Kpis><Kpi label="Net sales today" value={money(v.st.net)} /><Kpi label="Total takings" value={money(v.st.takings)} /><Kpi label="Tax included" value={money(v.st.tax)} /><Kpi label="Expected cash in drawer" value={money(expected)} /></Kpis>
          <Card className="mb-4"><h2 className="mb-2 text-lg font-semibold">Takings by payment type</h2>
            <Table><thead><tr><th>Payment</th><th className="text-right">Transactions</th><th className="text-right">Amount</th></tr></thead>
              <tbody>{PAYMENTS.map((p) => <tr key={p}><td>{p}</td><td className="text-right">{v.st.tenders[p].n}</td><td className="text-right">{money(v.st.tenders[p].v)}</td></tr>)}
                <tr className="font-bold"><td>Total takings</td><td className="text-right" /><td className="text-right">{money(v.st.takings)}</td></tr></tbody></Table>
            <p className="mt-2 text-sm text-slate-500">Net sales are {money(v.st.net)} over {v.st.count} sales. Takings also include special-order deposits taken today and exclude deposits that were taken earlier.</p></Card>
        </>
      ) : <Card className="mb-4"><p className="text-slate-500">The {oname(outletId)} register is closed.</p></Card>}
      <Card><h2 className="mb-2 text-lg font-semibold">Closed registers · {oname(outletId)}</h2>
        {history.length ? (
          <Table><thead><tr><th>Closed</th><th>Opened by</th><th>Closed by</th><th className="text-right">Net sales</th><th className="text-right">Cash difference</th><th /></tr></thead>
            <tbody>{history.map((x) => <tr key={x.id}><td>{fmtDate(x.closedAt)}</td><td>{name(x.openedBy)}</td><td>{name(x.closedBy)}</td><td className="text-right">{money(x.summary.net)}</td><td className="text-right">{x.variance == null ? 'Not counted' : money(x.variance)}</td><td><Btn v="soft" sm onClick={() => setReport(x)}>Report</Btn></td></tr>)}</tbody></Table>
        ) : <p className="text-slate-500">No closed registers yet.</p>}</Card>

      {opening && (
        <Drawer title={'Open register · ' + oname(opening)} onClose={() => setOpening(null)}>
          <p className="mb-3 text-slate-500">Sales made after this will be recorded at <b>{oname(opening)}</b>. Counting the opening cash is optional.</p>
          <form onSubmit={open} className="space-y-3">
            <Field label="Opening float ($), optional" type="number" min="0" step="0.05" autoFocus value={float} onChange={(e) => setFloat(e.target.value)} placeholder="Leave blank if you are not counting" />
            <div className="flex justify-end gap-2"><Btn v="soft" onClick={() => setOpening(null)}>Cancel</Btn><Btn type="submit">Open register</Btn></div>
          </form>
        </Drawer>
      )}
      {closing && cl.s && (
        <Drawer title={'Close register · ' + oname(closing)} onClose={() => setClosing(null)}>
          <form onSubmit={close} className="space-y-2">
            {PAYMENTS.map((p) => <div key={p} className="flex justify-between text-slate-600"><span>{p} ({cl.st.tenders[p].n})</span><span>{money(cl.st.tenders[p].v)}</span></div>)}
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><span>Net sales</span><span>{money(cl.st.net)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Opening float</span><span>{money(cl.s.float)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Expected cash in drawer</span><b className="text-slate-900">{money(clExpected)}</b></div>
            <Field label="Counted cash in drawer ($), optional" type="number" step="0.05" min="0" autoFocus value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Leave blank if you are not counting" />
            <div className="flex justify-between text-slate-600"><span>Difference</span><b className="text-slate-900">{counted === '' ? 'Not counted' : money((parseFloat(counted) || 0) - clExpected)}</b></div>
            <div className="flex justify-end gap-2 pt-2"><Btn v="soft" onClick={() => setClosing(null)}>Cancel</Btn><Btn type="submit">Close register and print</Btn></div>
          </form>
        </Drawer>
      )}
      {report && (
        <Drawer title="Register report" onClose={() => setReport(null)}>
          <CloseReport session={report} /><div className="mt-4 flex justify-end gap-2"><PrintButton node={<CloseReport session={report} />} /><Btn onClick={() => setReport(null)}>Done</Btn></div>
        </Drawer>
      )}
    </>
  )
}
