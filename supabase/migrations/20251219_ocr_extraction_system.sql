-- OCR Extraction & Fact Proposal System
-- Migration: Add tables for document extraction jobs and fact proposals

-- =============================================================================
-- DOCUMENT EXTRACTIONS (job queue + artifact storage)
-- =============================================================================

CREATE TABLE IF NOT EXISTS document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    slot_id UUID REFERENCES slots(id) ON DELETE SET NULL,
    document_file_id UUID NOT NULL REFERENCES document_files(id) ON DELETE CASCADE,
    
    -- Provider & versioning
    provider TEXT NOT NULL DEFAULT 'documentai',
    profile_key TEXT NOT NULL,  -- e.g., passport_v1, wp_current_permit_v1
    engine_version TEXT NOT NULL DEFAULT 'v1.0',
    idempotency_key TEXT UNIQUE NOT NULL,  -- hash(sha256 + profile + version)
    
    -- Job state
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled')),
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    
    -- Payload
    raw_json JSONB,
    text_content TEXT,
    pages_json JSONB,  -- anchors, bboxes, structured layout
    extracted_fields_json JSONB,  -- normalized candidates + confidence
    
    -- Retention / scrubbing
    raw_json_expires_at TIMESTAMPTZ,
    scrubbed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_extractions_app_status 
    ON document_extractions(application_id, status);
CREATE INDEX IF NOT EXISTS idx_extractions_doc_file 
    ON document_extractions(document_file_id, profile_key);
CREATE INDEX IF NOT EXISTS idx_extractions_next_attempt 
    ON document_extractions(next_attempt_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_extractions_org 
    ON document_extractions(org_id);

-- =============================================================================
-- FACT PROPOSALS (per-field suggestions from extractions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS fact_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version INT NOT NULL DEFAULT 1,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    extraction_id UUID NOT NULL REFERENCES document_extractions(id) ON DELETE CASCADE,
    source_document_file_id UUID NOT NULL REFERENCES document_files(id) ON DELETE CASCADE,
    source_slot_id UUID REFERENCES slots(id) ON DELETE SET NULL,
    
    -- Provenance (where in the document this came from)
    source_anchor JSONB,  -- {pageIndex, bbox: {x0,y0,x1,y1}, snippet}
    
    -- Targeting (where to write the data)
    field_key TEXT NOT NULL,  -- stable semantic key, e.g. person.passport.expiryDate
    target_entity_type TEXT NOT NULL
        CHECK (target_entity_type IN ('person', 'person_status', 'work_permit_attributes', 'employer')),
    target_entity_id UUID,  -- resolved entity ID
    field_path TEXT NOT NULL,  -- JSON path / column identifier
    operation TEXT NOT NULL DEFAULT 'set'
        CHECK (operation IN ('set', 'append', 'upsert_child')),
    
    -- Values
    proposed_value_json JSONB NOT NULL,
    current_value_json JSONB,  -- snapshot at proposal creation
    confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high')),
    
    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded', 'noop', 'irrelevant')),
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMPTZ,
    review_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- One proposal per field per extraction
    UNIQUE(extraction_id, field_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_app_status 
    ON fact_proposals(application_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_field_key 
    ON fact_proposals(field_key);
CREATE INDEX IF NOT EXISTS idx_proposals_extraction 
    ON fact_proposals(extraction_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org 
    ON fact_proposals(org_id);

-- =============================================================================
-- EXTEND EXISTING TABLES
-- =============================================================================

-- Add file_sha256 to document_files for idempotency key computation
ALTER TABLE document_files 
    ADD COLUMN IF NOT EXISTS file_sha256 TEXT;

CREATE INDEX IF NOT EXISTS idx_document_files_sha256 
    ON document_files(file_sha256) WHERE file_sha256 IS NOT NULL;

-- Add extraction_profile to slot_definitions
ALTER TABLE slot_definitions 
    ADD COLUMN IF NOT EXISTS extraction_profile TEXT;

-- Example values: 'passport_v1', 'wp_current_permit_v1', 'lmia_v1'

-- =============================================================================
-- UPDATE EXTRACTION PROFILES FOR EXISTING SLOT DEFINITIONS
-- =============================================================================

-- Passport slots should use passport_v1 profile
UPDATE slot_definitions 
SET extraction_profile = 'passport_v1' 
WHERE label ILIKE '%passport%' 
  AND extraction_profile IS NULL;

-- Current work permit/status slots
UPDATE slot_definitions 
SET extraction_profile = 'wp_current_permit_v1' 
WHERE (label ILIKE '%current%permit%' OR label ILIKE '%current%status%')
  AND extraction_profile IS NULL;
