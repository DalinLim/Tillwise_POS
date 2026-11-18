import { useState } from 'react'
import Layout from './components/Layout.jsx'
import Sale from './pages/Sale.jsx'
import Register from './pages/Register.jsx'
import History from './pages/History.jsx'
import Products from './pages/Products.jsx'
import Inventory from './pages/Inventory.jsx'
import Customers from './pages/Customers.jsx'
import Users from './pages/Users.jsx'
import Reports from './pages/Reports.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Quotes from './pages/Quotes.jsx'
import Orders from './pages/Orders.jsx'

const PAGES = { sale: Sale, register: Register, history: History, products: Products, inventory: Inventory, customers: Customers, users: Users, reports: Reports, dashboard: Dashboard, quotes: Quotes, orders: Orders }

export default function App() {
  const [page, setPage] = useState('register')
  const Page = PAGES[page]
  return <Layout page={page} setPage={setPage}><Page go={setPage} /></Layout>
}
