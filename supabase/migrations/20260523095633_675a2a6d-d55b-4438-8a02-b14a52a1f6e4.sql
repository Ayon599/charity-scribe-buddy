
ALTER TABLE public.admin_profiles
  ADD COLUMN email text,
  ADD COLUMN full_name text;

-- Backfill from existing profiles + auth.users
UPDATE public.admin_profiles ap
SET full_name = p.full_name
FROM public.profiles p
WHERE ap.user_id = p.id AND ap.full_name IS NULL;

UPDATE public.admin_profiles ap
SET email = u.email
FROM auth.users u
WHERE ap.user_id = u.id AND ap.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_first boolean;
  _invite_id uuid;
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
    INSERT INTO public.admin_profiles (user_id, email, full_name, status, is_active, approved_at)
    VALUES (NEW.id, NEW.email, _full_name, 'approved', true, now());
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');

    _invite_id := NULLIF(NEW.raw_user_meta_data ->> 'invitation_id','')::uuid;

    INSERT INTO public.admin_profiles (user_id, email, full_name, status, is_active, invited_by, invited_at)
    VALUES (
      NEW.id,
      NEW.email,
      _full_name,
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
