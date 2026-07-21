DROP POLICY IF EXISTS "authenticated_upload_checkin_photos" ON storage.objects;

CREATE POLICY "authenticated_upload_checkin_photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checkin-photos');

DROP POLICY IF EXISTS "authenticated_read_checkin_photos" ON storage.objects;

CREATE POLICY "authenticated_read_checkin_photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'checkin-photos');

NOTIFY pgrst, 'reload schema';