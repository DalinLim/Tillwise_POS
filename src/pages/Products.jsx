import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../services/api.js'
import { money } from '../lib/format.js'
import { nextBarcode } from '../lib/barcode.js'
import { Btn, Card, Drawer, Field, H1, Input, Select, Table, Tabs } from '../components/ui.jsx'
import Barcode from '../components/Barcode.jsx'
import { Label } from '../components/Printables.jsx'
import Categories from './Categories.jsx'
import Purchases from './Purchases.jsx'

function ProductDrawer({ product, onClose }) {
  const { db, run, print } = useStore()
  const isNew = !product
  const [f, setF] = useState(() => product ? { ...product, wholesale: String(product.wholesale ?? '') } : { sku: nextBarcode(db.products), name: '', categoryId: '', price: '', wholesale: '', cost: '', color: '#334155', reorderLevel: 5, stock: { syd: 0, pnh: 0 } })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    const price = +f.price
    const r = await run(() => api.products.save({ ...f, sku: f.sku.trim(), price, wholesale: f.wholesale === '' ? Math.round(price * 0.7) : +f.wholesale, cost: +f.cost, reorderLevel: +f.reorderLevel, stock: Object.fromEntries(Object.entries(f.stock || {}).map(([k, v]) => [k, +v])) }))
    if (r.ok) onClose()
  }
  const remove = async () => { if (confirm('Delete this product?')) { const r = await run(() => api.products.remove(f.id)); if (r.ok) onClose() } }
  const catName = db.categories.find((c) => c.id === f.categoryId)?.name
  return (
    <Drawer title={isNew ? 'Add product' : 'Edit product'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm text-slate-500">Barcode (13 digits)
          <div className="mt-1 flex gap-2"><Input required pattern="\d{13}" title="13 digits" inputMode="numeric" value={f.sku} onChange={set('sku')} /><Btn v="soft" onClick={() => setF({ ...f, sku: nextBarcode(db.products) })}>Generate</Btn></div></label>
        <Barcode code={f.sku} />
        <Field label="Name" required value={f.name} onChange={set('name')} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-slate-500">Category<Select required value={f.categoryId} onChange={set('categoryId')} className="mt-1 w-full"><option value="">Choose a category…</option>{db.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
          <label className="block text-sm text-slate-500">Frame colour<input type="color" value={f.color} onChange={set('color')} className="mt-1 h-10 w-full rounded-lg border border-slate-300" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3"><Field label="Retail price (incl. tax)" type="number" step="0.01" min="0" required value={f.price} onChange={set('price')} /><Field label="Wholesale price" type="number" step="0.01" min="0" value={f.wholesale} onChange={set('wholesale')} placeholder="Blank = 70% of retail" /></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Cost" type="number" step="0.01" min="0" required value={f.cost} onChange={set('cost')} /><Field label="Reorder level" type="number" min="0" required value={f.reorderLevel} onChange={set('reorderLevel')} /></div>
        {isNew && <div className="grid grid-cols-2 gap-3">{db.outlets.map((o) => <Field key={o.id} label={o.name + ' opening stock'} type="number" min="0" value={f.stock[o.id]} onChange={(e) => setF({ ...f, stock: { ...f.stock, [o.id]: e.target.value } })} />)}</div>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {!isNew && <Btn v="danger" onClick={remove}>Delete</Btn>}
          <Btn v="soft" onClick={() => print(<Label name={f.name} price={+f.price} sku={f.sku} />)}>Print label</Btn><Btn v="soft" onClick={onClose}>Cancel</Btn><Btn type="submit">Save{catName ? ' in ' + catName : ''}</Btn>
        </div>
      </form>
    </Drawer>
  )
}

function ProductList() {
  const { db, isAdmin, print } = useStore()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(undefined) // undefined = closed, null = new, object = edit
  const list = db.products.filter((p) => (p.name + ' ' + p.category + ' ' + p.sku).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <Card>
        <div className="mb-3 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, category or barcode" aria-label="Search products" />
          {isAdmin && <Btn onClick={() => setEdit(null)} className="whitespace-nowrap">+ Add product</Btn>}
        </div>
        {!isAdmin && <p className="mb-3 text-sm text-slate-500">Only an Admin can add or edit products.</p>}
        <Table><thead><tr><th>Barcode</th><th>Name</th><th>Category</th><th className="text-right">Retail</th><th className="text-right">Wholesale</th><th className="text-right">Cost</th><th className="text-right">Margin</th><th /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{p.category}</td><td className="text-right">{money(p.price)}</td><td className="text-right">{money(p.wholesale)}</td><td className="text-right">{money(p.cost)}</td><td className="text-right">{Math.round((1 - (p.cost * 1.1) / p.price) * 100)}%</td>
              <td className="whitespace-nowrap">{isAdmin && <Btn v="soft" sm onClick={() => setEdit(p)}>Edit</Btn>} <Btn v="soft" sm onClick={() => print(<Label name={p.name} price={p.price} sku={p.sku} />)}>Label</Btn></td></tr>
          ))}</tbody></Table>
      </Card>
      {edit !== undefined && <ProductDrawer product={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}

export default function Products() {
  const [tab, setTab] = useState('products')
  return (
    <>
      <H1>Products</H1>
      <Tabs value={tab} onChange={setTab} tabs={[['products', 'Products'], ['categories', 'Categories'], ['purchases', 'Purchases']]} />
      {tab === 'products' ? <ProductList /> : tab === 'categories' ? <Categories /> : <Purchases />}
    </>
  )
}
