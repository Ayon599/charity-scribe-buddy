
-- 1. Member types table
CREATE TABLE public.member_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage member_types"
  ON public.member_types FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view member_types"
  ON public.member_types FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_member_types_updated_at
  BEFORE UPDATE ON public.member_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed from existing enum
INSERT INTO public.member_types (name, sort_order) VALUES
  ('Founding', 1),
  ('Executive', 2),
  ('General', 3);

-- 2. Add member_type_id to members and backfill
ALTER TABLE public.members
  ADD COLUMN member_type_id uuid REFERENCES public.member_types(id);

UPDATE public.members m SET member_type_id = mt.id
FROM public.member_types mt
WHERE lower(mt.name) = m.member_type::text;

CREATE INDEX idx_members_member_type_id ON public.members(member_type_id);

-- 3. Member fund subscriptions
CREATE TABLE public.member_fund_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  monthly_amount numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, fund_id)
);

ALTER TABLE public.member_fund_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage member_fund_subscriptions"
  ON public.member_fund_subscriptions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_member_fund_subs_updated_at
  BEFORE UPDATE ON public.member_fund_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_mfs_member_id ON public.member_fund_subscriptions(member_id);
CREATE INDEX idx_mfs_fund_id ON public.member_fund_subscriptions(fund_id);
