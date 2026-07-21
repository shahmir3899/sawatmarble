-- CreateEnum
CREATE TYPE "ChallanStatus" AS ENUM ('draft', 'dispatched', 'delivered');

-- Own numbering series, independent of invoice_no_seq and
-- quotation_no_seq (per plan Section 6: DC-0001 style).
CREATE SEQUENCE "challan_no_seq" START WITH 1;

-- CreateTable
CREATE TABLE "delivery_challans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challan_no" TEXT NOT NULL DEFAULT ('DC-' || lpad(nextval('challan_no_seq')::text, 4, '0')),
    "customer_id" UUID NOT NULL,
    "quotation_id" UUID,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ChallanStatus" NOT NULL DEFAULT 'draft',
    "vehicle_number" TEXT,
    "driver_name" TEXT,
    "items_total" DECIMAL(12,2) NOT NULL,
    "terms_snapshot" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_challans_challan_no_key" ON "delivery_challans"("challan_no");

-- CreateTable
CREATE TABLE "delivery_challan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challan_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "size" TEXT,
    "qty" DECIMAL(12,2) NOT NULL,
    "sqft" DECIMAL(12,2) NOT NULL,
    "rate_per_sqft" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "delivery_challan_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "delivery_challan_items_challan_id_fkey" FOREIGN KEY ("challan_id") REFERENCES "delivery_challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security (defense-in-depth; requireRole in the backend is the
-- primary gate).
ALTER TABLE "delivery_challans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_challan_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_challans_select_all" ON "delivery_challans"
  FOR SELECT USING (auth.role() = 'authenticated');

-- Owner+staff only per the confirmed matrix ("Staff: create/edit ...
-- Delivery Challans ..."); accountant stays view-only, same as Quotation.
CREATE POLICY "delivery_challans_insert_owner_staff" ON "delivery_challans"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "delivery_challans_update_owner_staff" ON "delivery_challans"
  FOR UPDATE USING (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "delivery_challans_delete_owner_staff" ON "delivery_challans"
  FOR DELETE USING (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "delivery_challan_items_select_all" ON "delivery_challan_items"
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "delivery_challan_items_insert_owner_staff" ON "delivery_challan_items"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "delivery_challan_items_delete_owner_staff" ON "delivery_challan_items"
  FOR DELETE USING (public.current_user_role() IN ('owner', 'staff'));
