-- Customer/supplier churn is high in this business (per client feedback) —
-- staff need to add/remove records without owner involvement. Extends
-- delete from owner-only to owner+staff for customers and suppliers.
-- Inventory delete stays owner-only (rarer, higher-consequence change).
DROP POLICY "customers_delete_owner" ON "customers";
CREATE POLICY "customers_delete_owner_staff" ON "customers"
  FOR DELETE USING (public.current_user_role() IN ('owner', 'staff'));

DROP POLICY "suppliers_delete_owner" ON "suppliers";
CREATE POLICY "suppliers_delete_owner_staff" ON "suppliers"
  FOR DELETE USING (public.current_user_role() IN ('owner', 'staff'));
