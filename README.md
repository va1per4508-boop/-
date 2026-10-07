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

## Administrator management and barcode scanning

The administrator area manages models, companies, employees, colours and custom device fields. Renames cascade to current device assignments; employee renames also preserve authenticated scope by updating profile employee bindings. Items in use are archived instead of deleted. Administrators may edit device details, status and assignments with a required reason and before/after audit snapshots. Status identifiers remain the defined workflow states.

Apply `database/002-admin-import.sql` **after** `database/schema.sql` before enabling the updated app's shared backend. Migrations contain configuration only; no real inventory is committed. New employee catalogue entries do not automatically create authentication accounts.

Barcode scanning supports a mobile camera using ZXing (Code 128, EAN and other supported formats), USB keyboard scanners and manual entry. Use the main scan button for device lookup or the reception scan button to append a serial number. The scanner stops the camera on completion, close or cancellation. A separate barcode may be associated with a serial-numbered device through administrator editing. Browser camera access requires HTTPS and permission; granting camera access is controlled by the browser.

The import screen accepts XLSX with multiple worksheet tabs or CSV. The administrator selects a worksheet/header row, maps known fields, chooses explicit defaults, previews assignments and confirms any new catalogue values. Unmapped columns become custom fields; the original source row is retained. Missing reception dates stay blank. Duplicate serials, contradictory assignments, invalid dates and unresolved statuses block import. Each confirmed import is atomic and limited to 1,000 devices. Repeated worksheets must be imported separately with the appropriate defaults. Demo imports require an acknowledgement that the file contains only sample data.

The user's private Google Sheets source was not readable through the provided link (Google returned HTTP 401), and no authenticated Drive tool was available. No source data or inferred assignments were imported. Once access is granted, map and reconcile the source counts before writing to a configured, authenticated shared backend. Never embed real inventory or customer records into deployment source or this public repository.

Additional checks: `npm run test:admin` exercises management, custom fields, barcode lookup/reception and sample CSV imports; `npm run test:import` checks multi-sheet XLSX parsing, leading-zero serials, Hebrew headers, original data retention and date validation. The Code128 camera path was tested through a virtual camera containing a genuine generated barcode; real-device camera permissions and scanning conditions should be checked on the employee phones.

## Historical order sheets

Apply `database/003-legacy-records.sql` after the first two migrations. The application recognises legacy company worksheets containing order quantities and no serial column. It preserves each order row with quantity, model, client, company, payment, original amount, city, notes, order date and all original source columns. Formula-only template rows are skipped; rows without models are retained separately for accessory/charge/cancellation review. These rows are not counted as serialised warehouse stock. No serials or employees are fabricated. Invalid dates require explicit corrections and retain the original source value. A repeated sheet/row is rejected or skipped when unchanged.

Historical rows have administrator-only writes and employee-scoped reads after explicit assignment. Catalogue renames cascade to historical rows with audit records. Test with `npm run test:legacy` and `npm run test:legacy-ui`.

The uploaded real workbook was parsed and validated in a private local workspace. It is intentionally excluded from this public repository and from deployment source. The live site still has no shared database connection, so the real records have not been written to the deployed application.
