
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TYPE public.member_type AS ENUM ('founding', 'executive', 'general');
CREATE TYPE public.payment_method AS ENUM ('cash', 'bkash', 'nagad', 'rocket', 'bank', 'other');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ FUNDS ============
CREATE TABLE public.funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;

INSERT INTO public.funds (name, code, description, sort_order) VALUES
  ('Founding/Executive Monthly', 'FOUNDING_MONTHLY', 'Monthly fees from founding and executive members', 1),
  ('General Monthly', 'GENERAL_MONTHLY', 'Monthly fees from general members', 2),
  ('Kowmi Education', 'KOWMI_EDU', 'Donations for Kowmi Education', 3),
  ('Sadaqah Jariyah', 'SADAQAH', 'Sadaqah Jariyah donations', 4),
  ('Eid Fitra', 'FITRA', 'Eid Fitra collection', 5),
  ('Zakat', 'ZAKAT', 'Zakat collection', 6),
  ('Sports', 'SPORTS', 'Sports fund', 7);

-- ============ MEMBERS ============
CREATE SEQUENCE public.members_no_seq START 1;
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_no INT NOT NULL UNIQUE DEFAULT nextval('public.members_no_seq'),
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  address TEXT,
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  monthly_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  member_type member_type NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.members_no_seq OWNED BY public.members.member_no;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_members_mobile ON public.members(mobile);
CREATE INDEX idx_members_active ON public.members(is_active);

-- ============ TRANSACTIONS (income) ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE RESTRICT,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  for_month DATE,
  donor_name TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_txn_fund_date ON public.transactions(fund_id, txn_date);
CREATE INDEX idx_txn_member ON public.transactions(member_id);
CREATE INDEX idx_txn_date ON public.transactions(txn_date);

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES public.funds(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  payee TEXT,
  description TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_exp_fund_date ON public.expenses(fund_id, expense_date);
CREATE INDEX idx_exp_date ON public.expenses(expense_date);

-- ============ RECEIPTS ============
CREATE SEQUENCE public.receipts_no_seq START 1;
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no TEXT NOT NULL UNIQUE,
  serial INT NOT NULL DEFAULT nextval('public.receipts_no_seq'),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  issued_to TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER SEQUENCE public.receipts_no_seq OWNED BY public.receipts.serial;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_receipts_txn ON public.receipts(transaction_id);

-- Trigger to auto-format receipt_no like PF-2026-0001
CREATE OR REPLACE FUNCTION public.set_receipt_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_no IS NULL OR NEW.receipt_no = '' THEN
    NEW.receipt_no := 'PF-' || to_char(now(), 'YYYY') || '-' || lpad(NEW.serial::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_receipt_no
BEFORE INSERT ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.set_receipt_no();

-- ============ updated_at trigger helper ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_funds_updated BEFORE UPDATE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_txn_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_exp_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUTO-CREATE PROFILE & FIRST-USER ADMIN ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  -- First user becomes admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles: users see/update own
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles: admins manage; users can read their own
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- funds: admin only
CREATE POLICY "Admins manage funds" ON public.funds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- members: admin only
CREATE POLICY "Admins manage members" ON public.members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- transactions: admin only
CREATE POLICY "Admins manage transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- expenses: admin only
CREATE POLICY "Admins manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- receipts: admin only
CREATE POLICY "Admins manage receipts" ON public.receipts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
