-- Supabase Storage Bucket Setup for Documents
-- This migration sets up the 'documents' bucket with proper policies.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,  -- Not public
    10485760,  -- 10MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- 2. Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- 3. Allow service role full access (used by Edge Functions)
-- The service_role key bypasses RLS, but explicit policy ensures it works
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 4. Allow authenticated users to upload documents
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- 5. Allow authenticated users to read documents
CREATE POLICY "Authenticated users can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- 6. Allow authenticated users to update documents
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
CREATE POLICY "Authenticated users can update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 7. Allow authenticated users to delete documents
CREATE POLICY "Authenticated users can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
