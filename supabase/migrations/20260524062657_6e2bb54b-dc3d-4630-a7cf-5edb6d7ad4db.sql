
-- 1. Wipe app data
TRUNCATE TABLE
  public.receipts,
  public.transactions,
  public.expenses,
  public.member_fund_subscriptions,
  public.member_member_types,
  public.members,
  public.member_types,
  public.funds,
  public.admin_audit_log,
  public.admin_invitations,
  public.admin_profiles,
  public.user_roles,
  public.profiles
RESTART IDENTITY CASCADE;

-- 2. Wipe auth users
DELETE FROM auth.users;

-- 3. Drop invitation + audit tables
DROP TABLE IF EXISTS public.admin_invitations CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;

-- 4. Drop unused RPC
DROP FUNCTION IF EXISTS public.validate_invitation_token(text);

-- 5. Simplify admin_profiles
ALTER TABLE public.admin_profiles
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS rejected_by,
  DROP COLUMN IF EXISTS rejected_at,
  DROP COLUMN IF EXISTS rejected_reason,
  DROP COLUMN IF EXISTS invited_by,
  DROP COLUMN IF EXISTS invited_at;

-- 6. Rewrite handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_first boolean;
  _full_name text;
BEGIN
  _full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email);

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, _full_name);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin')
  ) INTO _is_first;

  IF _is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  INSERT INTO public.admin_profiles (user_id, email, full_name, is_active)
  VALUES (NEW.id, NEW.email, _full_name, true);

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
