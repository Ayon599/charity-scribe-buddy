
-- 1) Harden handle_new_user: only the very first user becomes an active super admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    -- Self-registered accounts after bootstrap get NO roles and remain inactive.
    -- A super admin must explicitly grant roles and activate the account.
    INSERT INTO public.admin_profiles (user_id, email, full_name, is_active)
    VALUES (NEW.id, NEW.email, _full_name, false);
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Revoke anon EXECUTE on role-check functions; keep authenticated for RLS.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
