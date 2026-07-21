-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'staff', 'accountant');

-- CreateEnum
CREATE TYPE "ItemUnit" AS ENUM ('sqft', 'piece');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'staff',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "ledger_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "ledger_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "description" TEXT NOT NULL,
    "size" TEXT,
    "unit" "ItemUnit" NOT NULL DEFAULT 'sqft',
    "default_rate_per_sqft" DECIMAL(12,2),
    "qty_on_hand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "direction" "StockDirection" NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "reference_type" TEXT,
    "reference_id" UUID,
    "note" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link profiles 1:1 to Supabase Auth users
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES auth.users(id) ON DELETE CASCADE;

-- Helper: current caller's role. SECURITY DEFINER avoids RLS recursion when
-- policies on `profiles` itself call this function.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS "Role"
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Auto-create a profile (default role: staff) whenever a new Supabase Auth
-- user signs up. An owner promotes/demotes the role afterward.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security. NOTE: this is a defense-in-depth layer for direct
-- Supabase/PostgREST access (e.g. supabase-js from the frontend). The
-- primary authorization gate is the Express backend's role-check
-- middleware, since the backend connects with a role that bypasses RLS.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;

-- profiles: everyone can read their own row; owner can read/update everyone's
CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_owner_all" ON "profiles"
  FOR SELECT USING (public.current_user_role() = 'owner');

CREATE POLICY "profiles_update_owner_all" ON "profiles"
  FOR UPDATE USING (public.current_user_role() = 'owner');

-- customers: any authenticated user can view; owner+staff manage; only owner deletes
CREATE POLICY "customers_select_all" ON "customers"
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "customers_insert_owner_staff" ON "customers"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "customers_update_owner_staff" ON "customers"
  FOR UPDATE USING (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "customers_delete_owner" ON "customers"
  FOR DELETE USING (public.current_user_role() = 'owner');

-- suppliers: same shape as customers
CREATE POLICY "suppliers_select_all" ON "suppliers"
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "suppliers_insert_owner_staff" ON "suppliers"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "suppliers_update_owner_staff" ON "suppliers"
  FOR UPDATE USING (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "suppliers_delete_owner" ON "suppliers"
  FOR DELETE USING (public.current_user_role() = 'owner');

-- inventory_items: any authenticated user can view; owner+staff manage per plan Section 8 permission matrix
CREATE POLICY "inventory_select_all" ON "inventory_items"
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "inventory_insert_owner_staff" ON "inventory_items"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "inventory_update_owner_staff" ON "inventory_items"
  FOR UPDATE USING (public.current_user_role() IN ('owner', 'staff'));

CREATE POLICY "inventory_delete_owner" ON "inventory_items"
  FOR DELETE USING (public.current_user_role() = 'owner');

-- stock_movements: append-only ledger. Any authenticated user can view;
-- owner+staff can insert; no UPDATE/DELETE policy exists (immutable by design).
CREATE POLICY "stock_movements_select_all" ON "stock_movements"
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stock_movements_insert_owner_staff" ON "stock_movements"
  FOR INSERT WITH CHECK (public.current_user_role() IN ('owner', 'staff'));
