# Tillwise Supabase setup

## What is included

- `docs/schema.sql`: original core POS schema.
- `docs/upgrade-schema.sql`: additive tables for Supabase Auth profiles, outlet memberships, suppliers, gift cards, layby instalments, customer birthdays/follow-ups, staff sales targets (no commission), and quote/receipt email logs.
- `src/services/supabase.js`: browser client and email/password auth helpers.
- `.env.example`: required public frontend configuration.

## Setup steps

1. Create a Supabase project.
2. Open **SQL Editor** and run `docs/schema.sql` first, if the core schema has not already been created.
3. Run `docs/upgrade-schema.sql` second.
4. In Supabase **Authentication → Providers**, enable Email. Disable public sign-ups if only an administrator should create staff accounts.
5. Create the first Auth user in Supabase Authentication.
6. Insert a matching row into `user_profiles` using that Auth user's UUID, then add rows to `user_outlets` for the outlets the user may access. The first administrator profile must be provisioned by the project owner.
7. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**.
8. Install dependencies with `npm install`, then run `npm run dev`.

## Important security and rollout notes

- Never put a Supabase `service_role` key in the Vite frontend. Only the anon/public key belongs in `VITE_SUPABASE_ANON_KEY`.
- The SQL migration enables RLS. Its feature-table policies are an authenticated-only starter policy, not the final outlet-level authorization policy. Before inviting cashier/manager accounts, replace those policies with policies that verify `user_outlets` membership and role for each outlet. Core tables from `schema.sql` also need RLS policies before production use.
- The existing `src/services/api.js` still powers the current demo/localStorage UI. The new Supabase client is a connection/auth foundation; it does not silently migrate demo data or switch existing CRUD operations to the server. That requires the next integration step and testing of each workflow.
- Email delivery must happen in a trusted server function (for example, a Supabase Edge Function) with provider credentials stored as server secrets. Do not send email directly with private credentials from the browser.
- Gift card codes should be generated and hashed server-side; never store full redeemable codes in plain text.
- Configure Sydney as AUD and Phnom Penh as USD only if that is the intended store policy. Confirm currency and tax rules before accepting live payments. The migration defaults reflect the current demo's Sydney/AUD and Phnom Penh/USD assumptions and can be changed in `outlets`.
