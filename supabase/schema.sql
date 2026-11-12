-- ==============================================================================
-- AquaPulse Supabase Database & Storage Setup Script
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vkcfcgexkfznfrpsahik/sql/new
-- ==============================================================================

-- 1. Create the reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id TEXT NOT NULL DEFAULT 'other',
    category_label TEXT NOT NULL DEFAULT 'Other',
    address_line1 TEXT NOT NULL DEFAULT 'Unknown Street',
    address_line2 TEXT,
    landmark TEXT,
    description TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'reported',
    latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
    longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
    user_latitude DOUBLE PRECISION,
    user_longitude DOUBLE PRECISION,
    distance_from_user DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for chronological sorting
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at DESC);

-- 2. Enable Row Level Security (RLS) on reports table
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public/anon) to read reports
DROP POLICY IF EXISTS "Allow public read access on reports" ON public.reports;
CREATE POLICY "Allow public read access on reports"
ON public.reports FOR SELECT
TO public
USING (true);

-- Allow anyone (public/anon) to insert new reports
DROP POLICY IF EXISTS "Allow public insert access on reports" ON public.reports;
CREATE POLICY "Allow public insert access on reports"
ON public.reports FOR INSERT
TO public
WITH CHECK (true);

-- 3. Storage Policies for the report-photos bucket
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

