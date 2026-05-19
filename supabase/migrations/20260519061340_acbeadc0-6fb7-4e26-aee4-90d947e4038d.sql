
UPDATE storage.buckets SET public = false WHERE id = 'transaction-attachments';

DROP POLICY IF EXISTS "Public read transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update transaction attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete transaction attachments" ON storage.objects;

CREATE POLICY "Admins read transaction attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'transaction-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload transaction attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update transaction attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'transaction-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete transaction attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-attachments' AND public.has_role(auth.uid(), 'admin'));
