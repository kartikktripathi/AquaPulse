-- ==============================================================================
-- AquaPulse Supabase Database & Storage Setup Script
-- ==============================================================================

-- 1. Ensure the Report table exists and has RLS policies configured
ALTER TABLE IF EXISTS public."Report" ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public/anon) to read reports
DROP POLICY IF EXISTS "Allow public read access on Report" ON public."Report";
CREATE POLICY "Allow public read access on Report"
ON public."Report" FOR SELECT
TO public
USING (true);

-- Allow anyone (public/anon) to insert new reports
DROP POLICY IF EXISTS "Allow public insert access on Report" ON public."Report";
CREATE POLICY "Allow public insert access on Report"
ON public."Report" FOR INSERT
TO public
WITH CHECK (true);

-- Allow anyone (public/anon) to update reports (e.g. adding photos)
DROP POLICY IF EXISTS "Allow public update access on Report" ON public."Report";
CREATE POLICY "Allow public update access on Report"
ON public."Report" FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 2. Storage Setup for the report-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public / anon users to upload photos to report-photos
DROP POLICY IF EXISTS "Allow public uploads to report-photos" ON storage.objects;
CREATE POLICY "Allow public uploads to report-photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'report-photos');

-- Allow public users to view photos in report-photos
DROP POLICY IF EXISTS "Allow public reads from report-photos" ON storage.objects;
CREATE POLICY "Allow public reads from report-photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'report-photos');

-- Allow public updates to report-photos
DROP POLICY IF EXISTS "Allow public updates to report-photos" ON storage.objects;
CREATE POLICY "Allow public updates to report-photos"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'report-photos')
WITH CHECK (bucket_id = 'report-photos');

-- Allow public deletes from report-photos
DROP POLICY IF EXISTS "Allow public deletes from report-photos" ON storage.objects;
CREATE POLICY "Allow public deletes from report-photos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'report-photos');

