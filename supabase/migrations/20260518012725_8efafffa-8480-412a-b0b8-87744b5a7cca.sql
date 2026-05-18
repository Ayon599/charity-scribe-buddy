
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS attachment_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-attachments', 'transaction-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read transaction attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'transaction-attachments');

CREATE POLICY "Authenticated upload transaction attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-attachments');

CREATE POLICY "Authenticated update transaction attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'transaction-attachments');

CREATE POLICY "Authenticated delete transaction attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-attachments');
