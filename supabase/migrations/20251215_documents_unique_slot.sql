-- Ensure a single active document per (org, application, slot).
-- This enables safe upsert behavior and avoids races in client code.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'documents'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'documents_org_application_slot_unique'
    ) THEN
      ALTER TABLE public.documents
      ADD CONSTRAINT documents_org_application_slot_unique
      UNIQUE (org_id, application_id, slot_id);
    END IF;
  END IF;
END $$;

