-- Customers/suppliers/inventory move to soft-delete (active flag). Payments
-- have ON DELETE RESTRICT on customer_id/supplier_id to protect the audit
-- trail, which means any customer/supplier with payment history could
-- never be hard-deleted — undermining "removal must be easy". Archiving
-- (active = false) keeps removal instant and never blocked, while all
-- history stays intact and queryable.
ALTER TABLE "customers" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "suppliers" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "inventory_items" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
