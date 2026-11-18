# Tillwise POS (React + Tailwind)

Sunglasses retail point of sale for two outlets (Sydney and Phnom Penh):
- **Sale** screen with scan / type-to-search product codes, per-item discounts, custom items, held sales, and three modes: Sale, Special order (deposit now, balance on collection) and Quote
- **Register** open and close per outlet (opening float and counted cash are optional), takings by payment type
- **Products** (Admin only to add), **Categories** (Admin only) and **Purchases** (receive stock against a supplier invoice, scan or type codes, shows retail and wholesale price)
- **Inventory** by outlet, with adjust and transfer; **Sales history** with refunds; **Customers** with store credit
- **Reporting**: Today, Sales, Transactions, Inventory, Purchases and User activity, for either outlet or both
- **Users** with 4-digit passcodes; every action is written to the activity log

```
npm install
npm run dev       # http://localhost:5173
npm run build
```

Deploy on Vercel: import the repo and click Deploy (Vite is detected).

## Structure (ready for a database)

```
src/services/api.js     the ONLY file that reads/writes data (localStorage today)
src/data/seed.js        demo data, shaped like the tables in docs/schema.sql
src/lib/                pure functions: pricing, reports, barcodes, formatting
src/context/            StoreProvider: loads a snapshot, exposes run(fn) to call the api then refresh
src/components/         UI building blocks, receipts and reports for printing
src/pages/              one file per screen
docs/schema.sql         suggested PostgreSQL tables
```

To connect a real database, keep the function names in `api.js` and replace each body with a `fetch()` call to
your backend (or Supabase/Firebase). Do stock, tax and totals on the server too, and verify passcodes there.

Demo passcode for all sample users: `1234`. Admins can manage users, products, stock and reports.

## Supabase upgrade foundation

The project now includes an additive Supabase migration and client setup scaffold:

- Run `docs/schema.sql` (existing core schema), then `docs/upgrade-schema.sql` in Supabase SQL Editor.
- Copy `.env.example` to `.env` and add your Supabase project URL and anon/public key.
- Follow `docs/SUPABASE-SETUP.md` to provision the first administrator and outlet memberships.

The current POS screens still use the existing localStorage data layer until the CRUD workflows are migrated and tested against Supabase. Do not use this build for live transactions until that integration and the remaining production RLS policies are completed.
