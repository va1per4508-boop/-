# מלאי — Rexton hearing aid inventory

Hebrew RTL inventory workspace for Audiotech, Patiphone Hearing Aids and Audio Sound Hearing Aids, with shared field staff: Yaron Gavri, Uriel Cohen, Chen Rosenberg and Zeev.

## Run

`npm ci` then `npm run dev`. Build: `npm run build`.

Without Supabase configuration, this is an explicitly labelled demonstration. Demo data is stored only in localStorage on the current browser. It is not a shared production database. Do not enter real customer data in demo mode. A JSON backup and filtered CSV export are available.

## Activate shared, authenticated storage

1. Create a Supabase project in your organisation and run `database/schema.sql` once against a new database.
2. Disable public signups. Create individual users from the Authentication dashboard and assign profiles as described at the bottom of the SQL file. Use a personal administrator account and one account per employee. Share credentials directly with employees, never through source control.
3. Set Vercel build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or publishable API key). Redeploy. Never use a service-role key in the frontend. The public API key is safe only with the supplied RLS policies.
4. The configured app opens on a real email/password login. It does not seed demonstration data into the shared database. Administrators see all stock; employees can see devices currently assigned to them and may deliver, start a trial or return their own devices. Returned devices leave an employee's scope and remain visible to the administrator.
5. Verify with one administrator and two employee accounts before entering real customer data. Test direct API reads and RPC writes as well as the UI. Verify worker A cannot read or modify worker B's devices, and cannot receive or reassign stock. Test concurrent updates and duplicate serial reception. The SQL schema and role isolation were verified against an embedded PostgreSQL instance (PGlite). Authenticated tests against a provisioned Supabase project are still required.
6. Configure organisation backup retention and a password reset process in Supabase before daily use. The UI directs forgotten-password requests to the administrator.

## Included

Dashboard with computed stock counts; serial-level device cards; multi-device reception; company and employee assignment; inter-employee transfer; customer delivery; trial end dates; return quarantine; confirmed inspection before restocking; repairs and supplier returns; append-only activity records; search and filters; CSV export; responsive RTL layouts.

The server authoritatively validates transitions and permissions. RPCs use row locks and expected versions to prevent concurrent overwrites. Shipment receipt is atomic and serials are unique regardless of case. Browser demo validates the same state transitions but has no authentication.

Models in the demo are examples, not a verified supplier catalogue; reception allows typing the actual model. There is no accounting, invoicing, barcode camera capture, automated notification sending, or medical record storage. Trial alerts and repair queues are visible in the app.

## Verification

`npm run test:database` checks role isolation, forbidden writes, unique serials, stale version rejection, and the full inventory lifecycle against embedded PostgreSQL. `npm run test:ui` runs browser checks against the dev server (install Chromium with `npx playwright install chromium` first). Set TEST_URL to check another deployment.
