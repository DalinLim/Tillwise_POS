import { useStore } from '../context/StoreContext.jsx'
import { Btn } from './ui.jsx'
import Barcode from './Barcode.jsx'
import { money, fmtDate, PAYMENTS } from '../lib/format.js'

const Line = ({ a, b, bold }) => <div className={'flex justify-between ' + (bold ? 'font-bold' : '')}><span>{a}</span><span>{b}</span></div>
const Rule = () => <hr className="my-2 border-dashed border-slate-400" />

export function Receipt({ sale }) {
  const { db } = useStore()
  const outlet = db.outlets.find((o) => o.id === sale.outletId)
  const cashier = db.users.find((u) => u.id === sale.cashierId)
  const customer = db.customers.find((c) => c.id === sale.customerId)
  const cash = sale.payment.method === 'Cash'
  const prior = sale.depositApplied || 0
  return (
    <div className="w-[80mm] max-w-full font-mono text-sm text-black">
      {cash && <div className="mb-3 rounded-xl border-2 border-black p-3 text-center text-xl font-bold">Change due {money(sale.payment.change)}</div>}
      <h2 className="text-base font-bold">Tillwise Sunglasses · {outlet?.name}</h2>
      <p>{sale.kind === 'order' ? 'Special order pickup' : 'Sale'} #{sale.number} · {fmtDate(sale.t)}<br />Served by {cashier?.name || '-'}</p>
      {sale.status === 'refunded' && <p className="font-bold">REFUNDED</p>}
      <Rule />
      {sale.items.map((i, n) => (
        <div key={n}><Line a={`${i.qty} × ${i.name}`} b={money(i.price * i.qty)} />{i.discount > 0 && <Line a="  Discount" b={'-' + money(i.discount)} />}</div>
      ))}
      <Rule />
      <Line a="Tax included" b={money(sale.tax)} />
      <Line bold a="Total" b={money(sale.total)} />
      {prior > 0 && <><Line a="Deposit paid earlier" b={'-' + money(prior)} /><Line a="Balance paid now" b={money(sale.total - prior)} /></>}
      <Line a={'Paid by ' + sale.payment.method} b="" />
      {cash && <><Line a="Cash received" b={money(sale.payment.tendered)} /><Line a="Change" b={money(sale.payment.change)} /></>}
      {customer && <p className="mt-1">Customer: {customer.name}</p>}
      <p className="mt-2">Thank you for shopping with us.</p>
    </div>
  )
}

export function CloseReport({ session }) {
  const { db } = useStore()
  const name = (id) => db.users.find((u) => u.id === id)?.name || '-'
  const outlet = db.outlets.find((o) => o.id === session.outletId)
  const s = session.summary
  return (
    <div className="w-[80mm] max-w-full font-mono text-sm text-black">
      <h2 className="text-base font-bold">Register close report</h2>
      <p>{outlet?.name}<br />Opened {fmtDate(session.openedAt)} by {name(session.openedBy)}<br />Closed {fmtDate(session.closedAt)} by {name(session.closedBy)}</p>
      <Rule />
      {PAYMENTS.map((p) => <Line key={p} a={`${p} (${s.tenders[p].n})`} b={money(s.tenders[p].v)} />)}
      <Line bold a="Total takings" b={money(s.takings)} />
      <Rule />
      <Line bold a="Net sales" b={money(s.net)} /><Line a="Tax included" b={money(s.tax)} /><Line a="Transactions" b={s.count} />
      {s.deposits !== 0 && <Line a="Order deposits (net)" b={money(s.deposits)} />}
      <Rule />
      <Line a="Opening float" b={money(session.float)} /><Line a="Expected cash" b={money(session.expected)} />
      <Line a="Counted cash" b={session.counted == null ? 'Not counted' : money(session.counted)} />
      <Line bold a="Difference" b={session.variance == null ? 'n/a' : money(session.variance)} />
    </div>
  )
}

export function QuoteDoc({ quote }) {
  const { db } = useStore()
  const outlet = db.outlets.find((o) => o.id === quote.outletId)
  const customer = db.customers.find((c) => c.id === quote.customerId)
  const by = db.users.find((u) => u.id === quote.createdBy)
  return (
    <div className="w-full max-w-[180mm] text-sm text-black">
      <div className="flex justify-between border-b-2 border-black pb-2"><div><h2 className="text-xl font-bold">Quote #{quote.number}</h2><div>Tillwise Sunglasses · {outlet?.name}</div></div><div className="text-right">Date {fmtDate(quote.t)}<br />Valid until {quote.validUntil}</div></div>
      <div className="my-3"><b>Prepared for</b><br />{customer ? <>{customer.name}<br />{customer.address}<br />{customer.phone} {customer.email}</> : 'Customer'}</div>
      <table className="w-full text-left [&_td]:border-b [&_td]:py-1 [&_th]:border-b [&_th]:py-1">
        <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Discount</th><th className="text-right">Total</th></tr></thead>
        <tbody>{quote.items.map((i, n) => <tr key={n}><td>{i.name}</td><td className="text-right">{i.qty}</td><td className="text-right">{money(i.price)}</td><td className="text-right">{i.discount ? '-' + money(i.discount) : ''}</td><td className="text-right">{money(i.net)}</td></tr>)}</tbody>
      </table>
      <div className="ml-auto mt-3 w-60"><Line a="Subtotal" b={money(quote.subtotal)} /><Line a="Discounts" b={'-' + money(quote.discount)} /><Line a="Tax included" b={money(quote.tax)} /><Line bold a="Total" b={money(quote.total)} /></div>
      {quote.notes && <p className="mt-3"><b>Notes:</b> {quote.notes}</p>}
      <p className="mt-4 text-xs">Prices include tax. This quote is valid until {quote.validUntil}. Stock is not reserved until the sale is paid. Prepared by {by?.name || '-'}.</p>
    </div>
  )
}

export function OrderReceipt({ order }) {
  const { db } = useStore()
  const outlet = db.outlets.find((o) => o.id === order.outletId)
  const customer = db.customers.find((c) => c.id === order.customerId)
  const paid = order.payments.reduce((a, p) => a + p.amount, 0)
  return (
    <div className="w-[80mm] max-w-full font-mono text-sm text-black">
      <h2 className="text-base font-bold">Special order #{order.number}</h2>
      <p>Tillwise Sunglasses · {outlet?.name}<br />{fmtDate(order.t)}<br />Customer: {customer?.name}<br />Expected: {order.expectedDate}</p>
      <Rule />
      {order.items.map((i, n) => <Line key={n} a={`${i.qty} × ${i.name}`} b={money(i.net)} />)}
      <Rule />
      <Line bold a="Total" b={money(order.total)} /><Line a="Deposit paid" b={money(paid)} /><Line bold a="Balance due on collection" b={money(order.total - paid)} />
      {order.notes && <p className="mt-2">Notes: {order.notes}</p>}
      <p className="mt-2">Status: {order.status}. Keep this slip to collect your order.</p>
    </div>
  )
}

export function PurchaseDoc({ purchase }) {
  const { db } = useStore()
  const outlet = db.outlets.find((o) => o.id === purchase.outletId)
  const by = db.users.find((u) => u.id === purchase.receivedBy)
  return (
    <div className="w-full max-w-[190mm] text-sm text-black">
      <h2 className="text-lg font-bold">Stock received #{purchase.number}</h2>
      <p className="mb-2">{outlet?.name} · received {fmtDate(purchase.t)} by {by?.name || '-'}<br />Supplier / factory: <b>{purchase.supplier}</b> · Invoice <b>{purchase.invoiceNo}</b> dated {purchase.date}</p>
      <table className="w-full text-left [&_td]:border-b [&_td]:py-1 [&_th]:border-b-2 [&_th]:py-1">
        <thead><tr><th>Product number</th><th>Product</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">Wholesale</th><th className="text-right">Retail</th><th className="text-right">Line cost</th></tr></thead>
        <tbody>{purchase.items.map((i, n) => <tr key={n}><td>{i.sku}</td><td>{i.name}</td><td className="text-right">{i.qty}</td><td className="text-right">{money(i.unitCost)}</td><td className="text-right">{money(i.wholesale)}</td><td className="text-right">{money(i.retail)}</td><td className="text-right">{money(i.qty * i.unitCost)}</td></tr>)}
          <tr className="font-bold"><td colSpan="6">Total cost</td><td className="text-right">{money(purchase.total)}</td></tr></tbody>
      </table>
      {purchase.notes && <p className="mt-2">Notes: {purchase.notes}</p>}
    </div>
  )
}

export const Label = ({ name, price, sku }) => (
  <div className="w-[60mm] text-center font-mono text-sm text-black"><b>{name || 'Product'}</b><br />{price ? money(price) : ''}<br /><Barcode code={sku} /></div>
)

// Generic table used to print reports
export function ReportSheet({ title, sub, head, rows, foot }) {
  return (
    <div className="text-sm text-black">
      <h2 className="text-lg font-bold">{title}</h2><p className="mb-2">{sub}</p>
      <table className="w-full text-left [&_td]:border-b [&_td]:p-1 [&_th]:border-b-2 [&_th]:p-1">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}{foot && <tr className="font-bold">{foot.map((c, j) => <td key={j}>{c}</td>)}</tr>}</tbody>
      </table>
    </div>
  )
}

export const PrintButton = ({ node }) => {
  const { print } = useStore()
  return <Btn v="soft" onClick={() => print(node)}>Print</Btn>
}
