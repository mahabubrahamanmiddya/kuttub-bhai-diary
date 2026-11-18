-- ==============================================================================
-- KUTTUB BHAI DIARY - BUSINESS HISAB-KITAB DATABASE SCHEMA
-- Compatible with Supabase PostgreSQL with Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked directly to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on owner_id for fast business lookups
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON public.businesses(owner_id);

-- 3. CUSTOMERS TABLE (Khaatedar / Grahak)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  -- opening_balance_type: 'receivable' (lene hain) or 'payable' (advance diya)
  opening_balance_type TEXT NOT NULL DEFAULT 'receivable' CHECK (opening_balance_type IN ('receivable', 'payable')),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- 4. SUPPLIERS TABLE (Vyapari / Vendors)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  -- opening_balance_type: 'payable' (dene hain) or 'receivable' (advance diya)
  opening_balance_type TEXT NOT NULL DEFAULT 'payable' CHECK (opening_balance_type IN ('payable', 'receivable')),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business_id ON public.suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON public.suppliers(phone);

-- 5. CATEGORIES TABLE (Expense & Income Categories)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'both')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_categories_business_id ON public.categories(business_id);

-- 6. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'sale',              -- Customer credit/cash sale (Receivable increases or cash sale)
      'customer_payment', -- Customer pays money (Receivable decreases, Cash/Bank increases)
      'purchase',          -- Supplier credit purchase (Payable increases, purchase cost)
      'supplier_payment', -- Payment made to supplier (Payable decreases, Cash/Bank decreases)
      'income',            -- Direct business income (Revenue increases, Cash/Bank increases)
      'expense'            -- Direct business expense (Expense increases, Cash/Bank decreases)
    )
  ),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category_name TEXT,
  payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Card', 'Other')),
  description TEXT,
  attachment_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_transactions_business_id ON public.transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_supplier_id ON public.transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if business belongs to the authenticated user
CREATE OR REPLACE FUNCTION public.is_business_owner(biz_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.businesses
    WHERE id = biz_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Businesses Policies
CREATE POLICY "Users can view own businesses"
  ON public.businesses FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create businesses"
  ON public.businesses FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own businesses"
  ON public.businesses FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own businesses"
  ON public.businesses FOR DELETE
  USING (owner_id = auth.uid());

-- Customers Policies
CREATE POLICY "Users can view customers of own business"
  ON public.customers FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can create customers in own business"
  ON public.customers FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY "Users can update customers in own business"
  ON public.customers FOR UPDATE
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can delete customers in own business"
  ON public.customers FOR DELETE
  USING (public.is_business_owner(business_id));

-- Suppliers Policies
CREATE POLICY "Users can view suppliers of own business"
  ON public.suppliers FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can create suppliers in own business"
  ON public.suppliers FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY "Users can update suppliers in own business"
  ON public.suppliers FOR UPDATE
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can delete suppliers in own business"
  ON public.suppliers FOR DELETE
  USING (public.is_business_owner(business_id));

-- Categories Policies
CREATE POLICY "Users can view categories of own business"
  ON public.categories FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can create categories in own business"
  ON public.categories FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY "Users can update categories in own business"
  ON public.categories FOR UPDATE
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can delete categories in own business"
  ON public.categories FOR DELETE
  USING (public.is_business_owner(business_id));

-- Transactions Policies
CREATE POLICY "Users can view transactions of own business"
  ON public.transactions FOR SELECT
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can create transactions in own business"
  ON public.transactions FOR INSERT
  WITH CHECK (public.is_business_owner(business_id));

CREATE POLICY "Users can update transactions in own business"
  ON public.transactions FOR UPDATE
  USING (public.is_business_owner(business_id));

CREATE POLICY "Users can delete transactions in own business"
  ON public.transactions FOR DELETE
  USING (public.is_business_owner(business_id));

-- ==============================================================================
-- AUTOMATIC PROFILE & DEFAULT DATA CREATION ON SIGNUP
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_biz_id UUID;
  v_biz_name TEXT;
  v_user_name TEXT;
  v_user_phone TEXT;
BEGIN
  v_user_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_biz_name := COALESCE(new.raw_user_meta_data->>'business_name', 'Mera Business');
  v_user_phone := new.raw_user_meta_data->>'phone';

  -- 1. Create Profile
  INSERT INTO public.profiles (id, name, phone)
  VALUES (new.id, v_user_name, v_user_phone)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, phone = EXCLUDED.phone;

  -- 2. Create Default Business
  INSERT INTO public.businesses (owner_id, business_name, phone, email)
  VALUES (new.id, v_biz_name, v_user_phone, new.email)
  RETURNING id INTO v_biz_id;

  -- 3. Seed Default Categories for the business
  INSERT INTO public.categories (business_id, name, type, is_default)
  VALUES
    (v_biz_id, 'Rent (किराया)', 'expense', true),
    (v_biz_id, 'Electricity (बिजली बिल)', 'expense', true),
    (v_biz_id, 'Transport / Freight (भाड़ा / परिवहन)', 'expense', true),
    (v_biz_id, 'Salary / Wages (वेतन / मजदूरी)', 'expense', true),
    (v_biz_id, 'Raw Material / Stock (माल खरीद)', 'expense', true),
    (v_biz_id, 'Maintenance & Repairs (मरम्मत)', 'expense', true),
    (v_biz_id, 'Tea / Food / Refreshment (चाय / नाश्ता)', 'expense', true),
    (v_biz_id, 'Marketing / Ads (प्रचार)', 'expense', true),
    (v_biz_id, 'Mobile / Internet (मोबाइल / इंटरनेट)', 'expense', true),
    (v_biz_id, 'General Expense (अन्य खर्च)', 'expense', true),
    (v_biz_id, 'General Sales (बिक्री आय)', 'income', true),
    (v_biz_id, 'Commission / Service (कमीशन / सेवा)', 'income', true),
    (v_biz_id, 'Other Income (अन्य आय)', 'income', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
