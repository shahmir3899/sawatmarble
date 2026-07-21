# Sawat Marble Stone & Granite — Business Management App
### Agent build guide / project specification
Last updated: 2026-07-21

---

## Implementation status — read this before anything else

If you're picking this project up in a new session with no other context, this section is the source of truth for **what currently exists**. Sections 1-10 below are the original spec/rationale and are still accurate for *why* things are built the way they are — but they were written before implementation started, so treat anything in them that describes a "plan" or "open question" as historical unless this section says otherwise.

**Live URLs:**
- Frontend: https://sawat-marble-client.onrender.com
- Backend API: https://sawat-marble-api.onrender.com
- Repo: https://github.com/shahmir3899/sawatmarble

**Demo accounts** (Supabase Auth, pre-confirmed email, password `SawatDemo123!` for all three — created via `server/scripts/seed-roles.ts`, safe to re-run, idempotent):
- `owner@sawatmarble.test`
- `staff@sawatmarble.test`
- `accountant@sawatmarble.test`

### Built and live

| Module | Status | Notes |
|---|---|---|
| Auth + roles | ✅ Live | Supabase Auth, `profiles` table (auto-created on signup via a trigger on `auth.users`, default role `staff`), RLS + `requireRole` Express middleware as the real gate |
| Customers / Suppliers | ✅ Live | Full CRUD, soft-delete (`active` flag), inline-editable rows, owner-only direct `ledgerBalance` edit (the opening-balance mechanism) |
| Inventory | ✅ Live | Full CRUD, soft-delete, sqft calculator (Length × Width × Qty), optional per-item `reorderLevel` for low-stock alerts |
| Customer/Supplier ledger | ✅ Live (customer side proven; supplier side has no document generating charges — see gaps below) | `payments` is the atomic ledger event; the Ledger dialog on each Customer/Supplier row shows history and lets any role record a payment |
| Receipt/Invoice | ✅ Live | `invoice_no` sequence continues from 1908 (paper book's last was 1907); one DB transaction computes Previous Balance → Total → Advance → Balance exactly per Section 3.3; advance auto-recorded as a linked `payment`; PDF export |
| Quotation | ✅ Live | `QT-0001...` own numbering sequence; fully editable (status + items) since it never touches the ledger; PDF export |
| Delivery Challan | ✅ Live | `DC-0001...` own numbering sequence; optional link back to a Quotation (`ON DELETE SET NULL`, not cascaded — challan survives if the quotation is later removed); vehicle/driver fields; PDF export; "Received By" signature line given more prominence than the other two documents, per Section 3.3 |
| Dashboard | ✅ Live | Today's sales (computed on a Pakistan-time day boundary, not server UTC), outstanding receivables, low-stock alert tile + table, merged recent-activity feed across all document types |
| PDF export | ✅ Live | `pdfkit`, not Puppeteer (Section 2 originally left this open — see "Decisions made along the way" below) — red/black palette matching the paper invoice, deliberately distinct from the app's gold UI chrome |
| Sidebar nav + mobile responsive | ✅ Live | Grouped sidebar (Overview/Contacts/Stock/Documents) replaces the earlier flat tab bar; collapses to an off-canvas drawer with hamburger toggle below 900px width; every data table wrapped in a horizontal-scroll container |

### Not built yet

| Module | Status | Notes |
|---|---|---|
| Supplier-side "Purchase" document | ❌ Not started | No equivalent of Receipt for the supplier side. A supplier's `ledgerBalance` can currently only move via a direct owner edit or a `payment` (decrease only) — there's no transaction that *increases* what's owed to a supplier. The `purchases` entity from Section 5 is still just a plan, no table exists. |
| Stock movement wiring | ❌ Not started | `stock_movements` table exists (from the very first migration) but nothing writes to it — no document decrements `inventory_items.qtyOnHand` on a sale. |
| Labour/Staff module | ❌ Not started | No schema at all — no `staff`, `attendance`, or `wage_advances` tables. |
| Owner-editable footer terms | ❌ Not started | The 5 standard terms (Section 3.3) are a hardcoded constant, duplicated across `server/src/routes/{receipts,quotations,deliveryChallans}.ts` — not editable via the app despite the confirmed permission matrix (Section 8) saying Owner should be able to edit footer terms/branding. |
| Ledger aging | ❌ Not started | Dashboard and the Ledger dialog show a raw balance, not days-overdue. |
| WhatsApp share-intent | ⏸ Explicitly deferred | User asked to skip this (2026-07-21) right after PDF export shipped, to prioritize finishing the Quotation/Challan/Dashboard build order instead. Design already confirmed if resumed: `wa.me` share-intent link, download-then-attach flow (wa.me cannot carry file attachments — see Section 8 Q4). No code exists for this. |
| `message_log` table | ❌ Not started | Depends on WhatsApp integration above. |

### Decisions made along the way (not in the original spec, or superseding it)

- **Soft-delete, not hard-delete.** `customers`, `suppliers`, and `inventory_items` all carry an `active` boolean; "Remove" in the UI sets it `false` rather than deleting the row. Discovered via testing: `payments.customer_id`/`supplier_id` and `stock_movements.item_id` have `ON DELETE RESTRICT` foreign keys protecting their audit trails, so a hard delete would be permanently blocked for any customer/supplier/item with real transaction history — i.e. almost all of them, defeating the "removal must stay easy" requirement. List endpoints filter to `active = true`; a non-zero `ledgerBalance` or `qtyOnHand` still blocks archiving, so a debt or real stock can't silently vanish from view.
- **RLS is defense-in-depth, not the enforcement layer.** The Express backend connects to Postgres with a role that bypasses RLS entirely. Every table still has RLS policies matching the permission matrix (protects data if the frontend ever queries Supabase directly), but the actual gate on every route is the `requireRole` Express middleware (`server/src/middleware/requireRole.ts`), which attaches the caller's resolved `profile` to `req.profile` for finer-grained per-field checks (e.g. direct `ledgerBalance` edits being owner-only).
- **Supabase connection uses the session pooler, not the direct connection string.** `db.<ref>.supabase.co` is IPv6-only, which proved unreliable both from Render and intermittently from local dev. `DATABASE_URL` uses `aws-0-<region>.pooler.supabase.com:5432` instead — this is also Supabase's own recommended way to connect an app backend, not just a workaround.
- **PDF library is `pdfkit`, not Puppeteer.** Puppeteer's headless-Chromium dependency is a known source of flaky deploys on constrained free-tier hosts (missing system libs, OOM crashes); the invoice/quotation/challan layouts are fundamentally fixed-position boxes and a grid table, which `pdfkit` handles directly without that risk.
- **Prisma migrations are applied with `migrate deploy`, not `migrate dev`.** `migrate dev` uses a temporary shadow database to diff schema changes, and that shadow database doesn't have Supabase's `auth` schema (which our migrations reference via `auth.users`/`auth.uid()`/`auth.role()`). Every migration in this project was hand-written SQL (not `prisma migrate dev`'s auto-diff) and applied via `prisma migrate deploy`, which skips the shadow-DB step entirely.
- **Numbering sequences are already primed and partially consumed.** `invoice_no_seq` starts at 1908, `quotation_no_seq`/`challan_no_seq` start at 1 (formatted `QT-0001`/`DC-0001`). All three have already issued a handful of real numbers during development testing — don't be surprised the *next* number issued isn't the very first in the sequence.
- **Per-document-type permission granularity, refined from the original blanket matrix.** Accountant can create Receipts/Invoices (✅), but is blocked (403) from creating/editing Quotations and Delivery Challans — Staff-authored documents. Worth reconfirming with the client if this doesn't match their expectation; see the updated matrix in Section 8.

### Where things live

- Backend routes: `server/src/routes/` — one file per resource (`customers.ts`, `suppliers.ts`, `inventory.ts`, `payments.ts`, `receipts.ts`, `quotations.ts`, `deliveryChallans.ts`, `dashboard.ts`)
- PDF templates: `server/src/pdf/` (`receiptPdf.ts`, `quotationPdf.ts`, `challanPdf.ts`) — near-identical layout code across the three; a shared layout helper would be a reasonable refactor if a fourth document type is ever added
- Prisma schema: `server/prisma/schema.prisma`; migrations in `server/prisma/migrations/` (hand-written SQL, applied via `prisma migrate deploy` — see "Decisions made along the way" above)
- Frontend pages: `client/src/pages/` — `DashboardPage.tsx`, `ContactsPage.tsx` (shared by Customers/Suppliers via a `resource` prop), `InventoryPage.tsx`, `ReceiptsPage.tsx`, `QuotationsPage.tsx`, `ChallansPage.tsx`
- Frontend nav: `client/src/components/Sidebar.tsx` + `icons.tsx` (hand-built SVG icons, geometric primitives only)
- Seed script: `server/scripts/seed-roles.ts` — creates/repairs the three demo accounts, safe to re-run

---

## 1. Business context (read this first)

This app is being built for a real, operating business: **Sawat Marble Stone & Granite**, Rawalpindi, Pakistan.

- **Business name:** Sawat Marble Stone & Granite
- **Tagline:** "Natural beauty. Timeless quality."
- **Address:** Gangal West Service Road, Rawalpindi, Pakistan
- **Owners / contacts:**
  - Zulfiqar Ali — 0311-5290097, 0304-9420334 (WhatsApp on both)
  - Iftikhar Ali — 0316-5619196 (WhatsApp)
- **Email:** sawatmarblestone4684@yahoo.com
- **Social:** Facebook — "Sawat Marble Stone & Granite"
- **What they do:** Wholesale trading of marble and granite. Buy processed slabs/tiles from suppliers, sell to customers — builders, contractors, individual buyers. Deal in kitchen counters, stairs, vanity tops, fireplaces, design borders, and patti (edge) strips, but **the dominant sales mode is standard stock sold by square foot** — not per-job custom fabrication. Custom/made-to-order items exist but are the minority case; the data model should treat stock-sale as the primary path and allow a line item to be flagged/noted as custom without needing a separate workflow in v1.
- **Currency:** PKR only.
- **Existing manual process:** paper invoice book (see Section 3) with running "Previous Balance → Total → Advance → Balance" — i.e. the business already runs on a customer-ledger model, not one-off invoicing. This is the most important behavioral fact for the data model: **every sale is a ledger event against a customer account**, not an isolated transaction.

Brand assets (logo, business card, sample invoice) have been supplied as images — see Section 3 for what each one tells us functionally, and hand the actual image files to the agent for use in the app header/login screen/PDF templates.

---

## 2. Tech stack (confirmed)

Chosen for speed of delivery: this is the same stack Mohsin already runs in production for P6 Intelligence and KoderKids/EducationAI, so conventions, deployment pipeline, and debugging experience all carry over — no new framework risk.

| Layer | Choice |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js / Express |
| Database | PostgreSQL (Supabase-hosted, connected via the session pooler — see Implementation Status) |
| Auth | Supabase Auth. Roles (Owner / Staff / Accountant) live in a `profiles` table (one row per `auth.users` id, `role` column) and are enforced with Postgres RLS policies as defense-in-depth, with `requireRole` Express middleware as the real gate. |
| Frontend hosting | Render Static Site (temporary free `*.onrender.com` URL until client provides a domain) |
| Backend hosting | Render Web Service |
| Database hosting | Supabase (free tier) |
| PDF generation | `pdfkit` (confirmed — see Implementation Status for why this beat Puppeteer) |
| Messaging | WhatsApp via `wa.me` share-intent links — design confirmed, **not yet built** (deferred 2026-07-21, see Implementation Status) |

**Estimated infra cost: $0–7/month.** (Free tier caveats: Render's free Web Service spins down after 15 min idle — first request after a gap takes ~30-50s to wake up; Supabase's free Postgres project pauses after 7 days with zero API activity. Neither should matter once staff are using the app daily, but worth knowing during early testing. If the cold-start delay bothers the client in practice, Render's paid Starter tier is ~$7/mo.)

This is a **web app**, not offline. No PowerSync, no local-first sync layer, no Electron/Tauri packaging. Single Postgres database is the source of truth; all clients (desktop browser, phone browser/PWA) hit it directly over the internet. This was a deliberate simplification after evaluating offline-first architecture — see Section 9 for the reasoning, in case it's ever revisited.

---

## 3. What the source images tell us (functional requirements extracted)

### 3.1 Logo / brand identity
- Colors: black background, gold/brass text, marble-texture accents (white/black veined marble, gray granite).
- Use gold-on-dark or gold-on-white as the primary brand treatment for headers, login screen — **confirmed as app-UI-only**; PDF documents deliberately use a *different* red/black palette matching the physical paper invoice book instead (see 3.3), since the client needs to recognize printed output as "theirs," not a generic redesign.
- Tagline "Natural beauty. Timeless quality." can appear on customer-facing documents (quotations, invoices) as a footer line — **not yet added to the PDF templates**.

### 3.2 Business card
- Confirms two named owner-users with distinct phone/WhatsApp numbers — supports the "Owner" role needing at least two accounts, not one shared login.
- Confirms product scope: "all kinds of marble and granite... kitchen counter, stairs, vanity tops, fireplaces, design borders, and patti strip."
- → **Inventory categories must include at minimum:** Marble, Granite, and sub-types/uses (slab, tile, counter piece, border/strip). A simple `category` + `sub_category` field on the item table covers this without over-engineering. **Implemented as-is.**

### 3.3 Sample invoice (the manual bill book) — this is the most important reference
Fields present on the existing paper form, which the digital Quotation/Challan/Invoice/Receipt templates must reproduce or exceed:

**Header block:**
- M/S Name, Address, Phone (customer info)
- Invoice No. (currently sequential — last seen: **1907**. App continues from **1908** — confirmed and live.)
- Date
- Delivery (Expected)

**Line item table columns:**
`Description | Size | Qty | Sq. ft | Rate/Sq.ft | Amount`

→ This confirms the sqft calculation model precisely: **Size (dimensions) × Qty → Sq.ft, then Sq.ft × Rate/Sq.ft → Amount.** The app's line-item entry form should let staff enter Size (e.g. length × height or a raw sqft override) and Qty, auto-calculate Sq.ft, let Rate/Sq.ft be entered or pulled from the item's default rate, and auto-calculate Amount. All four values should remain editable/overridable, since real-world negotiation happens. **Implemented as-is** (Length × Width × Qty calculator, all fields directly editable, on Receipt/Quotation/Challan line-item forms alike).

**Ledger footer block:**
`Previous Balance | Total | Advance | Balance`

→ Confirms every invoice is a running statement against the customer's account balance, not a standalone document. This must be a computed field pulled live from the customer ledger, not manually typed — **Previous Balance = customer's ledger balance immediately before this transaction. Total = Previous Balance + this invoice's Amount. Advance = payment received now. Balance = Total − Advance**, and this new Balance becomes the customer's ledger balance going forward. **Implemented exactly as specified**, on Receipt/Invoice only (Quotation/Challan never touch the ledger, by design).

**Standard printed terms (should be configurable footer text in the document templates, editable by Owner role):**
1. "In all natural Granite stones, variation in shades, veins & grains is possible."
2. "50% advance on order confirmation."
3. "Delay in delivery is possible due to unavoidable circumstances."
4. "Quantity & Quality should be checked at the time of delivery."
5. "No Guarantee of color variation."

→ **Printed on every PDF, but currently a hardcoded constant — Owner-editable terms not yet built** (see Implementation Status).

**Footer contact block:** address + both owners' phone numbers + email — should appear on every generated PDF (quotation, challan, invoice/receipt). **Implemented.**

**Signature line:** a blank "Signature:" line at the bottom — digital version can keep this as a printable signature line for physical sign-off at delivery, especially relevant for the Delivery Challan. **Implemented** — the Challan PDF gives this more visual prominence ("Received By (Signature)") than Receipt/Quotation, per this note.

---

## 4. Core modules (confirmed scope)

1. **Dashboard** ✅ — KPIs: today's sales, outstanding receivables total, low-stock alerts, recent activity feed.
2. **Inventory** ✅ — marble & granite stock, category/sub-category, size, sqft, rate, quantity on hand. Stock sale model (not fabrication-job tracking) per Section 1.
3. **Finance** — two ledgers:
   - **Supplier ledger** ⚠️ partial — balance tracked, payments (decreases) work, but no "Purchase" document exists to *increase* what's owed (see Implementation Status).
   - **Customer ledger** ✅ — running balance exactly matching the paper invoice's Previous Balance/Total/Advance/Balance logic. Aging (how overdue is the balance) ❌ not built.
4. **Labour / Staff module** ❌ — attendance, wage type (daily/monthly), advances against wages. Not started.
5. **Documents** ✅ — Quotation → Delivery Challan → Receipt/Invoice, matching the paper format in Section 3.2 exactly, with PDF export/print. All three live.
6. **Communication** ⏸ — WhatsApp share-intent links pre-filled with challan/invoice details, triggered from the Delivery Challan and Receipt screens. Design confirmed, build explicitly deferred.
7. **Roles & permissions** ✅ — Owner (full access, including editing footer terms/branding — the "editing" part of that isn't built yet, only the permission gate is), Staff, Accountant (finance-focused access). Permission matrix confirmed and implemented — see Section 8.

---

## 5. Data model overview

All tables below are live except where marked otherwise. RLS policies exist on every live table as defense-in-depth; `requireRole` Express middleware is the real authorization gate (see Implementation Status).

- `profiles` ✅ (id = FK to Supabase `auth.users.id`, name, phone, role: owner / staff / accountant) — auto-created by a trigger on `auth.users` insert (default role `staff`); only an owner can change a role afterward
- `customers` ✅ (name, address, phone, running `ledger_balance`, `active` soft-delete flag)
- `suppliers` ✅ (name, address, phone, running `ledger_balance`, `active` soft-delete flag)
- `inventory_items` ✅ (category, sub_category, description, size, default_rate_per_sqft, qty_on_hand, unit, `reorder_level`, `active` soft-delete flag)
- `stock_movements` ✅ table exists, ❌ nothing writes to it yet (item_id, direction: in/out, qty, reference_type: purchase/sale/adjustment, reference_id) — append-only, no update/delete policy
- `purchases` ❌ not built (supplier_id, date, items[], total, advance_paid, balance) — would update supplier ledger + stock in
- `quotations` ✅ + `quotation_items` ✅ (customer_id, date, items[], items_total, terms_snapshot, status: draft/sent/accepted/expired) — `quotation_no` own sequence (`QT-0001`...)
- `delivery_challans` ✅ + `delivery_challan_items` ✅ (customer_id, quotation_id?, date, items[], vehicle_number, driver_name, status: draft/dispatched/delivered) — `challan_no` own sequence (`DC-0001`...)
- `receipts` ✅ + `receipt_items` ✅ (customer_id, date, invoice_no, items[], previous_balance, items_total, total, advance, balance, terms_snapshot) — updates customer ledger; `invoice_no` continues the paper book's sequence from 1908
- `payments` ✅ (customer_id or supplier_id — exactly one, CHECK constraint; amount, method, note, reference_type/reference_id, payment_date) — the atomic ledger-affecting event; always decrements the target's balance
- `staff` ❌ not built (name, role, wage_type, rate)
- `attendance` ❌ not built (staff_id, date, status)
- `wage_advances` ❌ not built (staff_id, amount, date, notes)
- `message_log` ❌ not built (recipient, channel: whatsapp/sms, reference_type, reference_id, status) — depends on WhatsApp integration

**Design rule carried over from Mohsin's other projects:** records should be immutable-ish with a status field (e.g. challan: draft → dispatched → delivered) rather than deleted/overwritten. This matters even more here than in P6 Intelligence, because ledger disputes ("we never received this delivery") get settled by the record trail. **Implemented as soft-delete (`active` flag) rather than status-field-only** for customers/suppliers/inventory — see "Decisions made along the way" in Implementation Status for why.

---

## 6. Numbering & document flow

- Invoice numbering: continues from **1908** (last paper invoice was 1907). **Confirmed and live** — Postgres sequence `invoice_no_seq`.
- Quotations and Delivery Challans have their own independent numbering series: **`QT-0001`, `DC-0001`. Confirmed and live** — Postgres sequences `quotation_no_seq`/`challan_no_seq`, formatted with `lpad`.
- Flow: Quotation (optional/informal, often skipped for walk-in stock sales) → Delivery Challan (goods leave the yard) → Receipt/Invoice (financial close, updates ledger). **Implemented as designed** — Quotation is not a mandatory first step; a Challan can optionally link back to a Quotation (`quotationId`, nullable, `ON DELETE SET NULL`).

---

## 7. Build order (recommended)

1. **Auth + roles** ✅ (Supabase Auth + `profiles` table + RLS policies) + base app shell with Sawat branding (logo, colors) in header/login.
2. **Customers, Suppliers, Inventory** ✅ — the foundational tables everything else references.
3. **Customer & Supplier ledgers** ✅ (customer side proven end-to-end; supplier side can only decrease via payments, no purchase document — see Implementation Status) — Previous Balance/Total/Advance/Balance math implemented and tested.
4. **Document flow** ✅: Quotation → Delivery Challan → Receipt/Invoice, with PDF generation matching Section 3.2's layout (red/black, matching the paper book).
5. **Labour/Staff module** ❌ — not started.
6. **WhatsApp share-intent integration** ⏸ — deferred by explicit request (2026-07-21).
7. **Dashboard** ✅ — built last as planned, since it was just queries over data that existed by that point.

---

## 8. Open questions — status

1. **Invoice numbering:** ✅ resolved — continues from 1908, live.
2. **Quotation/Challan numbering scheme:** ✅ resolved — `QT-0001`, `DC-0001`, live.
3. **Permission matrix specifics:** ✅ resolved and implemented, with one refinement discovered during implementation (see "Decisions made along the way" in Implementation Status):

   **Confirmed permission matrix (as implemented):**

   | Action | Owner | Staff | Accountant |
   |---|---|---|---|
   | Create/edit Receipts/Invoices | ✅ | ✅ | ✅ |
   | Create/edit Quotations, Delivery Challans | ✅ | ✅ | ❌ (view only) |
   | Edit ledger balances directly (outside of a proper transaction record) | ✅ | ❌ | ❌ |
   | Record payments (customer & supplier) | ✅ | ✅ | ✅ |
   | View/manage ledgers and aging reports | ✅ | view only (balance), full (payments) | ✅ |
   | Manage inventory (create/edit) | ✅ | ✅ | ❌ (view only) |
   | Delete inventory item (archive) | ✅ | ❌ | ❌ |
   | Manage customer/supplier contact records (create/edit/remove) | ✅ | ✅ | view only |
   | Edit footer terms/branding | ✅ (gate exists; editing UI not built) | ❌ | ❌ |
   | Void/status-transition records (Quotation/Challan status) | ✅ | ✅ | view only |

4. **PDF delivery:** ✅ resolved — downloadable/printable PDF (view in new tab from a blob fetch, since auth is a Bearer token not a cookie session). WhatsApp attachment explicitly deferred (see Implementation Status); confirmed flow when resumed is download-then-attach, not a hosted-file-link, since `wa.me` cannot carry attachments regardless.
5. **Domain/hosting:** ⏸ still open — currently running on Render's free `*.onrender.com` subdomains for both frontend and backend. No custom domain decided yet.
6. **Historical data:** ✅ resolved — no bulk import. Owner-only direct `ledgerBalance` edit on the Customer/Supplier row **is** the opening-balance mechanism, implemented and live.

---

## 9. Notes on architecture decisions already made (for context, not action)

- Considered and rejected: fully offline Windows EXE (Electron/Tauri + local SQLite) — rejected because mobile access for the owners was required and offline-with-sync added sync-engine complexity (PowerSync/ElectricSQL) disproportionate to a single-business deployment.
- Considered and rejected: local-first sync architecture — same reasoning; a plain web app removes the need for conflict resolution entirely since Postgres is the single source of truth.
- Landed on: standard multi-user web app, PWA-installable on Android for field use if needed later, no true offline requirement identified for this client's actual working pattern (shop-based, not remote-site-based).
- See "Decisions made along the way" under **Implementation Status** at the top of this document for architecture decisions made *during* implementation (soft-delete, RLS-as-defense-in-depth, Supabase pooler connection, pdfkit over Puppeteer, hand-written migrations).

---

## 10. Working conventions for the agent

Carried over from Mohsin's established process on other projects — apply the same discipline here:
- Investigate before proposing; propose before coding.
- Paste the complete literal `git show` output after every commit.
- Verify claims with real evidence, not assumptions.
- Never deploy without explicit approval.
- Never print credential values into chat or commit messages.
- Treat every ledger-affecting record as append/status-transition rather than destructive edit/delete (implemented as soft-delete for master data, true append-only for `payments`/`receipts`/`quotations`/`delivery_challans`).
