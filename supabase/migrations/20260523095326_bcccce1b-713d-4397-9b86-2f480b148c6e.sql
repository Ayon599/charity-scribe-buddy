
-- 2. is_super_admin helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- 3. bootstrap_needed: true if no users exist yet (public, used by /signup gate)
CREATE OR REPLACE FUNCTION public.bootstrap_needed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1)
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_needed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_needed() TO anon, authenticated;

-- 4. admin_profiles
CREATE TABLE public.admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval','approved','rejected')),
  is_active boolean NOT NULL DEFAULT true,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejected_reason text,
  invited_by uuid,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own admin profile"
  ON public.admin_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins view all admin profiles"
  ON public.admin_profiles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update admin profiles"
  ON public.admin_profiles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Inserts/deletes happen only via SECURITY DEFINER trigger and edge functions (service role).

CREATE TRIGGER admin_profiles_set_updated_at
  BEFORE UPDATE ON public.admin_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. admin_invitations
CREATE TABLE public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text NOT NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_user_id uuid
);

CREATE INDEX admin_invitations_email_idx ON public.admin_invitations(lower(email));

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage invitations"
  ON public.admin_invitations FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 6. validate_invitation_token (callable without auth so accept-invite page can use it)
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text)
RETURNS TABLE (id uuid, email text, full_name text, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, full_name, expires_at
  FROM public.admin_invitations
  WHERE token = _token
    AND accepted_at IS NULL
    AND expires_at > now()
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.validate_invitation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(text) TO anon, authenticated;

-- 7. admin_audit_log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  target_user_id uuid,
  action text NOT NULL CHECK (action IN ('invite','accept','approve','reject','deactivate','reactivate','promote','demote','delete')),
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 8. Updated handle_new_user trigger: first user → super_admin approved; others → admin pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_first boolean;
  _invite_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role IN ('admin','super_admin')
  ) INTO _is_first;

  IF _is_first THEN
    -- Bootstrap: first user is super admin AND admin (so existing admin RLS works).
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.admin_profiles (user_id, status, is_active, approved_at)
    VALUES (NEW.id, 'approved', true, now());
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');

    -- If created via invitation, link it
    _invite_id := NULLIF(NEW.raw_user_meta_data ->> 'invitation_id','')::uuid;

    INSERT INTO public.admin_profiles (user_id, status, is_active, invited_by, invited_at)
    VALUES (
      NEW.id,
      'pending_approval',
      true,
      (SELECT invited_by FROM public.admin_invitations WHERE id = _invite_id),
      (SELECT created_at FROM public.admin_invitations WHERE id = _invite_id)
    );

    IF _invite_id IS NOT NULL THEN
      UPDATE public.admin_invitations
        SET accepted_at = now(), accepted_user_id = NEW.id
        WHERE id = _invite_id;

      INSERT INTO public.admin_audit_log (actor_user_id, target_user_id, action, metadata)
      VALUES (NEW.id, NEW.id, 'accept', jsonb_build_object('invitation_id', _invite_id));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure the trigger is attached (recreating is safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
