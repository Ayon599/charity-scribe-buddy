
CREATE TABLE public.member_member_types (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_type_id uuid NOT NULL REFERENCES public.member_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, member_type_id)
);

ALTER TABLE public.member_member_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage member_member_types"
ON public.member_member_types FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view member_member_types"
ON public.member_member_types FOR SELECT TO authenticated
USING (true);

INSERT INTO public.member_member_types (member_id, member_type_id)
SELECT id, member_type_id FROM public.members
WHERE member_type_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX idx_mmt_type ON public.member_member_types(member_type_id);
