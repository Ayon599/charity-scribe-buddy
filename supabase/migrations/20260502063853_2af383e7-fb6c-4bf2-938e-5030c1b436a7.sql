
-- Fix set_updated_at: add search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Fix set_receipt_no already has search_path; ensure
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

-- Revoke public execute on SECURITY DEFINER functions (handle_new_user runs as trigger; not needed via API)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_receipt_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role is used in RLS policies; keep it executable by authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
