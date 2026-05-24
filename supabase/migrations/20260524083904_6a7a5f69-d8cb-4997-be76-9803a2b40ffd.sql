
-- 1. has_role now requires active admin profile
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.admin_profiles ap ON ap.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ap.is_active = true
  )
$$;

-- is_super_admin same hardening
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.admin_profiles ap ON ap.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'super_admin'
      AND ap.is_active = true
  )
$$;

-- 2. Restrict user_roles writes to super_admins
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Super admins insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 3. Restrict member_types/member_member_types reads to admins only
DROP POLICY IF EXISTS "Authenticated view member_types" ON public.member_types;
DROP POLICY IF EXISTS "Authenticated view member_member_types" ON public.member_member_types;

-- 4. handle_new_user: non-first users start inactive
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
    INSERT INTO public.admin_profiles (user_id, email, full_name, is_active)
    VALUES (NEW.id, NEW.email, _full_name, true);
  ELSE
    -- Self-registered accounts after bootstrap start inactive
    INSERT INTO public.admin_profiles (user_id, email, full_name, is_active)
    VALUES (NEW.id, NEW.email, _full_name, false);
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Revoke public/anon execute on internal definer functions (keep bootstrap_needed open for signup gate)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_receipt_no() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
