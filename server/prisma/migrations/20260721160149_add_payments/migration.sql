-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "supplier_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_exactly_one_party" CHECK (num_nonnulls("customer_id", "supplier_id") = 1)
);

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (defense-in-depth; requireRole in the backend is the
-- primary gate, same architecture as every other table in this project).
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_all" ON "payments"
  FOR SELECT USING (auth.role() = 'authenticated');

-- Owner, staff, and accountant can all record payments per the confirmed
-- permission matrix. No UPDATE/DELETE policy exists — payments are
-- append-only, like stock_movements.
CREATE POLICY "payments_insert_owner_staff_accountant" ON "payments"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff', 'accountant'));
