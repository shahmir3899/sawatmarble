-- Invoice numbering continues the physical paper book's sequence (last
-- paper invoice was 1907; per client confirmation, the app continues from
-- 1908 rather than starting a fresh series).
CREATE SEQUENCE "invoice_no_seq" START WITH 1908;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "reference_type" TEXT;
ALTER TABLE "payments" ADD COLUMN "reference_id" UUID;

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_no" INTEGER NOT NULL DEFAULT nextval('invoice_no_seq'),
    "customer_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previous_balance" DECIMAL(12,2) NOT NULL,
    "items_total" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "advance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL,
    "terms_snapshot" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "receipts_invoice_no_key" ON "receipts"("invoice_no");

-- CreateTable
CREATE TABLE "receipt_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "size" TEXT,
    "qty" DECIMAL(12,2) NOT NULL,
    "sqft" DECIMAL(12,2) NOT NULL,
    "rate_per_sqft" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receipt_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security (defense-in-depth; requireRole in the backend is the
-- primary gate).
ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipt_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_select_all" ON "receipts"
  FOR SELECT USING (auth.role() = 'authenticated');

-- All three roles can create receipts per the confirmed permission matrix
-- ("Staff: create Receipts/Invoices"; "Accountant: create Receipts/Invoices").
-- No UPDATE/DELETE policy — a receipt is a permanent record once issued,
-- same as an entry in the physical invoice book.
CREATE POLICY "receipts_insert_all_roles" ON "receipts"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff', 'accountant'));

CREATE POLICY "receipt_items_select_all" ON "receipt_items"
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "receipt_items_insert_all_roles" ON "receipt_items"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff', 'accountant'));
