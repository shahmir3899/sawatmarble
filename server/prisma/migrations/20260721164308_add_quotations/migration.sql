-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'sent', 'accepted', 'expired');

-- Own numbering series, independent of the invoice sequence (per plan
-- Section 6: quotations/challans need their own series, confirmed as
-- QT-0001/DC-0001 style).
CREATE SEQUENCE "quotation_no_seq" START WITH 1;

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_no" TEXT NOT NULL DEFAULT ('QT-' || lpad(nextval('quotation_no_seq')::text, 4, '0')),
    "customer_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "QuotationStatus" NOT NULL DEFAULT 'draft',
    "items_total" DECIMAL(12,2) NOT NULL,
    "terms_snapshot" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quotations_quotation_no_key" ON "quotations"("quotation_no");

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "size" TEXT,
    "qty" DECIMAL(12,2) NOT NULL,
    "sqft" DECIMAL(12,2) NOT NULL,
    "rate_per_sqft" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security (defense-in-depth; requireRole in the backend is the
-- primary gate).
ALTER TABLE "quotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotation_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotations_select_all" ON "quotations"
  FOR SELECT USING (auth.role() = 'authenticated');

-- Owner+staff only per the confirmed matrix ("Staff: create/edit
-- Quotations..."); accountant isn't mentioned for this document type, so
-- it stays view-only for them, consistent with their finance-only scope.
CREATE POLICY "quotations_insert_owner_staff" ON "quotations"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "quotations_update_owner_staff" ON "quotations"
  FOR UPDATE USING (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "quotations_delete_owner_staff" ON "quotations"
  FOR DELETE USING (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "quotation_items_select_all" ON "quotation_items"
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "quotation_items_insert_owner_staff" ON "quotation_items"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "quotation_items_delete_owner_staff" ON "quotation_items"
  FOR DELETE USING (public.current_user_role() IN ('owner', 'staff'));
