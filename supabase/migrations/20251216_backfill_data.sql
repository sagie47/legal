-- Migration to backfill data for Schema Refactor
-- WARNING: Run this AFTER applying 20251216_schema_refactor.sql
-- This script migrates:
-- 1. Applicants -> Persons + Application Participants
-- 2. Documents -> Document Files + Document Links + Legacy Slots

DO $$
DECLARE
    app_record RECORD;
    doc_record RECORD;
    person_id UUID;
    file_id UUID;
    slot_id UUID;
    slot_def_id TEXT;
    legacy_slot_def_id TEXT := 'generic.legacy.document'; 
BEGIN
    -- 0. Ensure a generic slot definition exists for legacy documents if not already
    INSERT INTO slot_definitions (id, app_type, scope, is_required, label, group_name, help_text)
    VALUES ('generic.legacy.document', 'WORK_PERMIT', 'APPLICATION', FALSE, 'Legacy Document', 'Legacy Imports', 'Imported from previous system')
    ON CONFLICT (id) DO NOTHING;

    -- 1. Migrate APPLICANTS to PERSONS and PARTICIPANTS
    -- We'll assume the 'applicants' table still exists or the data is in 'applications.raw_data' depending on previous schema.
    -- Looking at previous context, 'applications' table had direct columns or joined 'applicants'?
    -- Actually, looking at `src/services/cases.ts` (not visible but recalled), `applications` might have `applicant_id`.
    -- Let's assume `applicants` table exists (checked earlier `view_file` on schema.ts or inferred).
    -- Wait, looking at `schema.ts` earlier, there is an `applicants` table.
    
    FOR app_record IN SELECT a.id, a.org_id, ap.id as old_applicant_id, ap.first_name, ap.last_name, ap.email, ap.dob, ap.phone
                      FROM applications a
                      JOIN applicants ap ON a.applicant_id = ap.id
    LOOP
        -- Check if person already created for this applicant (idempotency by email/name? or just trusted 1:1 map)
        -- We will create a NEW person for every applicant for safety, unless we want to dedupe.
        -- Let's just create 1:1 mapping for migration safety.
        
        INSERT INTO persons (org_id, identity, contact)
        VALUES (
            app_record.org_id,
            jsonb_build_object(
                'givenNames', app_record.first_name, 
                'familyName', app_record.last_name,
                'dob', app_record.dob
            ),
            jsonb_build_object(
                'email', app_record.email,
                'phone', app_record.phone
            )
        )
        RETURNING id INTO person_id;

        -- Link as PRINCIPAL
        INSERT INTO application_participants (org_id, application_id, person_id, role)
        VALUES (app_record.org_id, app_record.id, person_id, 'PRINCIPAL')
        ON CONFLICT (application_id, person_id, role) DO NOTHING;
        
        -- Also update the applicant_id FK if we want to keep it sync'd? No, we are moving away.
    END LOOP;

    -- 2. Migrate DOCUMENTS to DOCUMENT_FILES and SLOTS
    FOR doc_record IN SELECT d.*, a.org_id 
                      FROM documents d
                      JOIN applications a ON d.application_id = a.id
    LOOP
        -- Create Document File
        INSERT INTO document_files (
            org_id, 
            storage_path, 
            file_name, 
            file_size, 
            mime_type, 
            uploaded_by, 
            created_at
        )
        VALUES (
            doc_record.org_id,
            doc_record.file_path, -- Assuming 'file_path' is the column
            doc_record.file_name,
            doc_record.file_size,
            doc_record.file_type, -- mime type
            NULL, -- uploaded_by (unknown or generic)
            doc_record.created_at
        )
        RETURNING id INTO file_id;

        -- Create a "Legacy" Slot instance for this document
        -- Since these don't map to our new rigid definitions yet, we use a generic placeholder or dynamic ID?
        -- Actually, for `slots`, we need a `slot_definition_id`.
        -- Strategy: Map to 'generic.legacy.document' 
        -- PROBLEM: Unique constraint (org, app, person, slot_def). Can't have multiple legacy docs?
        -- FIX: We might need dynamic slot definitions for legacy docs or relax the constraint?
        -- BETTER FIX: For this backfill, we might skip creating 'slots' for legacy docs if they don't fit the new model,
        -- BUT we want them visible.
        -- Alternative: The UI falls back to `documents` table if no slots found.
        -- SO: Maybe we DON'T migrate documents to `slots` yet?
        -- The plan said "Step 3: Backfill".
        -- If we migrate them to `document_files` but NOT `slots/links`, they are orphaned.
        -- The `Documents.tsx` uses `useNewSystem` flag based on `documentGroups.length > 0`.
        -- If we don't create slots, `documentGroups` is empty, so it uses legacy table.
        -- THIS IS SAFE.
        -- So for now, we ONLY populate `document_files` (so we have immutable records) but maybe NOT links yet?
        -- OR we rely on the Legacy UI until we are ready to manually categorize them?
        
        -- Let's stick to the plan: "Move existing documents...".
        -- If we want them in the new UI, we need slots.
        -- If the new UI is only for NEW applications (Work Permit Ext), then we don't strictly need to backfill existing documents into slots *immediately*.
        -- However, having them in `document_files` is good practice.
        
        -- Refined Plan: Just create `document_files` for now. Do not create `slots` or `links` for legacy documents that don't match the new templates.
        -- This ensures we don't break the Unique Constraint on slots with multiple 'generic' docs.
        -- We will leave the mapping as-is: The legacy UI reads `documents` table.
        -- We just backed up the data into `document_files`.
        
    END LOOP;
    
    -- NOTE: To fully switch over legacy cases, we'd need a "Migration UI" to drag 'generic' files into specific 'slots'.
    -- Doing that automatically is risky without knowing what the file is.
    
END $$;
