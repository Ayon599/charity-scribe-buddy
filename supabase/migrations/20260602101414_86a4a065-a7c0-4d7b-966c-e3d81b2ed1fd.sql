CREATE TYPE public.blood_group AS ENUM ('A+','A-','B+','B-','O+','O-','AB+','AB-');

CREATE TABLE public.blood_donors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sl INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  blood_group public.blood_group NOT NULL,
  mobile TEXT,
  present_address TEXT,
  permanent_address TEXT,
  reference_person TEXT,
  reference_mobile TEXT,
  last_donation_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_donors TO authenticated;
GRANT ALL ON public.blood_donors TO service_role;

ALTER TABLE public.blood_donors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blood_donors"
ON public.blood_donors FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_blood_donors_updated_at
BEFORE UPDATE ON public.blood_donors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_blood_donors_blood_group ON public.blood_donors(blood_group);