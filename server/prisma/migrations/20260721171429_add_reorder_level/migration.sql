-- Nullable per-item reorder threshold for the Dashboard's low-stock alert.
-- Null means the item isn't tracked for alerts at all — a single global
-- threshold makes no sense across item types this different.
ALTER TABLE "inventory_items" ADD COLUMN "reorder_level" DECIMAL(12,2);
