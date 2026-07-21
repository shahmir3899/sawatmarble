# Sawat Marble Stone & Granite — Business Management App
### Agent build guide / project specification
Last updated: 2026-07-21

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
| Database | PostgreSQL (Supabase-hosted) |
| Auth | Supabase Auth. Roles (Owner / Staff / Accountant) live in a `profiles` table (one row per `auth.users` id, `role` column) and are enforced with Postgres RLS policies, not a separate auth provider's role field. |
| Frontend hosting | Render Static Site (temporary free `*.onrender.com` URL until client provides a domain) |
| Backend hosting | Render Web Service |
| Database hosting | Supabase (free tier) |
| PDF generation | Server-side (e.g. Puppeteer or a PDF library) rendering the invoice/challan/quotation templates |
| Messaging | WhatsApp via `wa.me` share-intent links (zero cost, zero API approval needed for v1); PDF is downloaded and manually attached by staff (wa.me cannot carry file attachments) |

**Estimated infra cost: $0–7/month.** (Free tier caveats: Render's free Web Service spins down after 15 min idle — first request after a gap takes ~30-50s to wake up; Supabase's free Postgres project pauses after 7 days with zero API activity. Neither should matter once staff are using the app daily, but worth knowing during early testing. If the cold-start delay bothers the client in practice, Render's paid Starter tier is ~$7/mo.)

This is a **web app**, not offline. No PowerSync, no local-first sync layer, no Electron/Tauri packaging. Single Postgres database is the source of truth; all clients (desktop browser, phone browser/PWA) hit it directly over the internet. This was a deliberate simplification after evaluating offline-first architecture — see Section 9 for the reasoning, in case it's ever revisited.

---

## 3. What the source images tell us (functional requirements extracted)

### 3.1 Logo / brand identity
- Colors: black background, gold/brass text, marble-texture accents (white/black veined marble, gray granite).
- Use gold-on-dark or gold-on-white as the primary brand treatment for headers, login screen, and PDF letterheads.
- Tagline "Natural beauty. Timeless quality." can appear on customer-facing documents (quotations, invoices) as a footer line.

### 3.2 Business card
- Confirms two named owner-users with distinct phone/WhatsApp numbers — supports the "Owner" role needing at least two accounts, not one shared login.
- Confirms product scope: "all kinds of marble and granite... kitchen counter, stairs, vanity tops, fireplaces, design borders, and patti strip."
- → **Inventory categories must include at minimum:** Marble, Granite, and sub-types/uses (slab, tile, counter piece, border/strip). A simple `category` + `sub_category` field on the item table covers this without over-engineering.

### 3.3 Sample invoice (the manual bill book) — this is the most important reference
Fields present on the existing paper form, which the digital Quotation/Challan/Invoice/Receipt templates must reproduce or exceed:

**Header block:**
- M/S Name, Address, Phone (customer info)
- Invoice No. (currently sequential — last seen: **1907**. Confirm with Mohsin/client whether the app should continue this sequence or start a fresh series; default assumption below is **continue from 1908** so historical numbering stays intact for the client.)
- Date
- Delivery (Expected)

**Line item table columns:**
`Description | Size | Qty | Sq. ft | Rate/Sq.ft | Amount`

→ This confirms the sqft calculation model precisely: **Size (dimensions) × Qty → Sq.ft, then Sq.ft × Rate/Sq.ft → Amount.** The app's line-item entry form should let staff enter Size (e.g. length × height or a raw sqft override) and Qty, auto-calculate Sq.ft, let Rate/Sq.ft be entered or pulled from the item's default rate, and auto-calculate Amount. All four values should remain editable/overridable, since real-world negotiation happens.

**Ledger footer block:**
`Previous Balance | Total | Advance | Balance`

→ Confirms every invoice is a running statement against the customer's account balance, not a standalone document. This must be a computed field pulled live from the customer ledger, not manually typed — **Previous Balance = customer's ledger balance immediately before this transaction. Total = Previous Balance + this invoice's Amount. Advance = payment received now. Balance = Total − Advance**, and this new Balance becomes the customer's ledger balance going forward.

**Standard printed terms (should be configurable footer text in the document templates, editable by Owner role):**
1. "In all natural Granite stones, variation in shades, veins & grains is possible."
2. "50% advance on order confirmation."
3. "Delay in delivery is possible due to unavoidable circumstances."
4. "Quantity & Quality should be checked at the time of delivery."
5. "No Guarantee of color variation."

**Footer contact block:** address + both owners' phone numbers + email — should appear on every generated PDF (quotation, challan, invoice/receipt).

**Signature line:** a blank "Signature:" line at the bottom — digital version can keep this as a printable signature line for physical sign-off at delivery, especially relevant for the Delivery Challan.

---

## 4. Core modules (confirmed scope)

1. **Dashboard** — KPIs: today's sales, outstanding receivables total, low-stock alerts, recent activity feed.
2. **Inventory** — marble & granite stock, category/sub-category, size, sqft, rate, quantity on hand. Stock sale model (not fabrication-job tracking) per Section 1.
3. **Finance** — two ledgers:
   - **Supplier ledger** — purchases, dues, payment history.
   - **Customer ledger** — running balance exactly matching the paper invoice's Previous Balance/Total/Advance/Balance logic, aging (how overdue is the balance).
4. **Labour / Staff module** — attendance, wage type (daily/monthly), advances against wages.
5. **Documents** — Quotation → Delivery Challan → Receipt/Invoice, matching the paper format in Section 3.2 exactly, with PDF export/print.
6. **Communication** — WhatsApp share-intent links pre-filled with challan/invoice details and a link/attachment, triggered from the Delivery Challan and Receipt screens.
7. **Roles & permissions** — Owner (full access, including editing footer terms/branding), Staff, Accountant (finance-focused access). Exact permission matrix to be defined in Section 8 (open question).

---

## 5. Data model overview (high-level — remaining DDL is a separate next step)

The first five entities below are live (migration `20260721064907_init_core_tables`, `server/prisma/schema.prisma`) with RLS policies on every table as a defense-in-depth layer; the real authorization gate is the Express backend's `requireRole` middleware, since the backend's DB connection uses a role that bypasses RLS (see `server/src/middleware/requireRole.ts`). Everything below `stock_movements` is still just the entity list, to be refined into DDL once the ledger math (Section 3.3/6) is implemented.

- `profiles` (id = FK to Supabase `auth.users.id`, name, phone, role: owner / staff / accountant) — auto-created by a trigger on `auth.users` insert (default role `staff`); only an owner can change a role afterward
- `customers` (name, address, phone, running `ledger_balance`)
- `suppliers` (name, address, phone, running `ledger_balance`)
- `inventory_items` (category, sub_category, description, size, default_rate_per_sqft, qty_on_hand, unit)
- `stock_movements` (item_id, direction: in/out, qty, reference_type: purchase/sale/adjustment, reference_id) — append-only, no update/delete policy
- `purchases` (supplier_id, date, items[], total, advance_paid, balance) — updates supplier ledger + stock in
- `quotations` (customer_id, date, items[], total, terms_snapshot, status)
- `delivery_challans` (customer_id, quotation_id?, date, items[], vehicle/driver info, status: draft/dispatched/delivered)
- `receipts` / `invoices` (customer_id, challan_id?, date, invoice_no, items[], previous_balance, total, advance, balance, terms_snapshot) — updates customer ledger
- `payments` (customer_id or supplier_id, amount, date, method, reference_id) — the atomic ledger-affecting event
- `staff` (name, role, wage_type, rate)
- `attendance` (staff_id, date, status)
- `wage_advances` (staff_id, amount, date, notes)
- `message_log` (recipient, channel: whatsapp/sms, reference_type, reference_id, status)

**Design rule carried over from Mohsin's other projects:** records should be immutable-ish with a status field (e.g. challan: draft → dispatched → delivered) rather than deleted/overwritten. This matters even more here than in P6 Intelligence, because ledger disputes ("we never received this delivery") get settled by the record trail.

---

## 6. Numbering & document flow

- Invoice numbering: continue from **1908** (last paper invoice was 1907) unless the client wants a clean break — **confirm before building**.
- Quotations and Delivery Challans likely need their own independent numbering series (e.g. `QT-0001`, `DC-0001`) since they're pre-sale and pre-delivery documents distinct from the invoice/receipt series. Confirm naming convention with client if they have an existing informal scheme.
- Suggested flow: Quotation (optional/informal, often skipped for walk-in stock sales) → Delivery Challan (goods leave the yard) → Receipt/Invoice (financial close, updates ledger). The app should not force Quotation as a mandatory first step, since most sales here are stock sales, not negotiated jobs.

---

## 7. Build order (recommended)

1. **Auth + roles** (Supabase Auth + `profiles` table + RLS policies) + base app shell with Sawat branding (logo, colors) in header/login.
2. **Customers, Suppliers, Inventory** — the foundational tables everything else references.
3. **Customer & Supplier ledgers** — get the Previous Balance/Total/Advance/Balance math right and tested before building documents on top of it.
4. **Document flow**: Quotation → Delivery Challan → Receipt/Invoice, with PDF generation matching Section 3.2's layout exactly (this is what the client will compare against their paper book — get it visually close).
5. **Labour/Staff module** — attendance + advances.
6. **WhatsApp share-intent integration** on Challan and Receipt screens.
7. **Dashboard** — last, since it's just queries over data that now exists.

---

## 8. Open questions — confirm before/while building

1. **Invoice numbering:** continue from 1908, or start fresh? (Default assumption: continue from 1908.)
2. **Quotation/Challan numbering scheme:** any existing convention, or assign one (e.g. `QT-0001`, `DC-0001`)?
3. **Permission matrix specifics:** ~~Can Staff create invoices but not edit ledger balances directly? Can Accountant record payments but not edit inventory?~~ Resolved — see the confirmed matrix below. Needs a simple table before the roles are wired into Supabase Auth via the `profiles` table + RLS policies.

   **Confirmed permission matrix:**

   | Action | Owner | Staff | Accountant |
   |---|---|---|---|
   | Create/edit Quotations, Delivery Challans, Receipts/Invoices | ✅ | ✅ | ✅ |
   | Edit ledger balances directly (outside of a proper transaction record) | ✅ | ❌ | ❌ |
   | Record payments (customer & supplier) | ✅ | ❌ | ✅ |
   | View/manage ledgers and aging reports | ✅ | view only | ✅ |
   | Manage inventory (stock in/out) | ✅ | ✅ | ❌ |
   | Manage customer/supplier contact records | ✅ | ✅ | view only |
   | Edit footer terms/branding | ✅ | ❌ | ❌ |
   | Void/status-transition records | ✅ | ❌ | ❌ |
4. **PDF delivery:** is a downloadable/printable PDF sufficient for v1, or does the client want the WhatsApp message to carry a direct PDF attachment link (requires file hosting) vs. just a text summary?
5. **Domain/hosting:** will this run under a subdomain of an existing property (e.g. `sawat.taiqmohsin.com` style) or a fresh domain for the client?
6. **Historical data:** is there a backlog of paper invoices/ledger balances to migrate in, or does the app start clean with today's balances entered manually as opening balances?

---

## 9. Notes on architecture decisions already made (for context, not action)

- Considered and rejected: fully offline Windows EXE (Electron/Tauri + local SQLite) — rejected because mobile access for the owners was required and offline-with-sync added sync-engine complexity (PowerSync/ElectricSQL) disproportionate to a single-business deployment.
- Considered and rejected: local-first sync architecture — same reasoning; a plain web app removes the need for conflict resolution entirely since Postgres is the single source of truth.
- Landed on: standard multi-user web app, PWA-installable on Android for field use if needed later, no true offline requirement identified for this client's actual working pattern (shop-based, not remote-site-based).

---

## 10. Working conventions for the agent

Carried over from Mohsin's established process on other projects — apply the same discipline here:
- Investigate before proposing; propose before coding.
- Paste the complete literal `git show` output after every commit.
- Verify claims with real evidence, not assumptions.
- Never deploy without explicit approval.
- Never print credential values into chat or commit messages.
- Treat every ledger-affecting record as append/status-transition rather than destructive edit/delete.
