-- Work Permit Schema Refactor Migration
-- Created: 2025-12-16
-- This migration adds the complete schema for Work Permit extension support

-- ============================================================================
-- PART 1: NEW ENUMS
-- ============================================================================

-- Application type enum
CREATE TYPE app_type AS ENUM (
    'WORK_PERMIT',
    'STUDY_PERMIT', 
    'VISITOR',
    'PR_SPOUSAL',
    'EE_PROFILE',
    'EE_EAPR'
);

-- Processing context enum
CREATE TYPE processing_context AS ENUM (
    'OUTSIDE_CANADA',
    'INSIDE_CANADA',
    'PORT_OF_ENTRY'
);

-- Action intent enum
CREATE TYPE action_intent AS ENUM (
    'INITIAL',
    'EXTEND',
    'CHANGE_EMPLOYER',
    'CHANGE_CONDITIONS',
    'RESTORE'
);

-- Program type enum (for work permits)
CREATE TYPE program_type AS ENUM (
    'TFWP',
    'IMP'
);

-- Authorization model enum
CREATE TYPE authorization_model AS ENUM (
    'EMPLOYER_SPECIFIC',
    'OPEN'
);

-- Participant role enum
CREATE TYPE participant_role AS ENUM (
    'PRINCIPAL',
    'SPOUSE',
    'CHILD',
    'SPONSOR'
);

-- Immigration status type enum
CREATE TYPE immigration_status_type AS ENUM (
    'WORK_PERMIT',
    'STUDY_PERMIT',
    'VISITOR',
    'TRP',
    'PR'
);

-- Slot state enum
CREATE TYPE slot_state AS ENUM (
    'missing',
    'uploaded',
    'in_review',
    'verified',
    'rejected',
    'expired'
);

-- Slot scope enum
CREATE TYPE slot_scope AS ENUM (
    'PRINCIPAL',
    'SPOUSE',
    'EMPLOYER',
    'APPLICATION'
);

-- ============================================================================
-- PART 2: NEW COLUMNS ON EXISTING TABLES
-- ============================================================================

-- Add typed columns to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS app_type app_type,
ADD COLUMN IF NOT EXISTS processing_context processing_context,
ADD COLUMN IF NOT EXISTS action_intent action_intent,
ADD COLUMN IF NOT EXISTS program_type program_type,
ADD COLUMN IF NOT EXISTS authorization_model authorization_model,
ADD COLUMN IF NOT EXISTS sub_type_code TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ;

-- ============================================================================
-- PART 3: NEW TABLES
-- ============================================================================

-- 3.1 Persons table (first-class person entities)
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    identity JSONB, -- { familyName, givenNames, dob, sex, maritalStatus }
    passport JSONB, -- { number, country, issueDate, expiryDate }
    contact JSONB,  -- { email, phone, address }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS persons_org_id_idx ON persons(org_id);

-- 3.2 Application participants (links persons to applications)
CREATE TABLE IF NOT EXISTS application_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role participant_role NOT NULL DEFAULT 'PRINCIPAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(application_id, person_id, role)
);

CREATE INDEX IF NOT EXISTS application_participants_app_idx ON application_participants(application_id);
CREATE INDEX IF NOT EXISTS application_participants_person_idx ON application_participants(person_id);

-- 3.3 Person statuses (status timeline for maintained status logic)
CREATE TABLE IF NOT EXISTS person_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    status_type immigration_status_type NOT NULL,
    valid_from DATE,
    valid_to DATE, -- This is the key field for expiry/maintained status
    conditions JSONB, -- Employer-specific conditions, restrictions, etc.
    permit_number TEXT,
    source_document_file_id UUID, -- Links to document_files (added later if exists)
    is_current BOOLEAN DEFAULT FALSE,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS person_statuses_person_idx ON person_statuses(person_id, status_type, valid_to DESC);
CREATE INDEX IF NOT EXISTS person_statuses_current_idx ON person_statuses(person_id) WHERE is_current = TRUE;

-- 3.4 Case events (append-only audit log)
CREATE TABLE IF NOT EXISTS case_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- APPLICATION_CREATED, STATUS_EXPIRY_SET, etc.
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS case_events_app_idx ON case_events(application_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS case_events_person_idx ON case_events(person_id, occurred_at DESC);

-- 3.5 Slot definitions (template library)
CREATE TABLE IF NOT EXISTS slot_definitions (
    id TEXT PRIMARY KEY, -- Stable key like 'wp.passport.biopage'
    app_type app_type NOT NULL,
    processing_context processing_context,
    action_intent action_intent,
    program_type program_type, -- NULL = applies to both
    authorization_model authorization_model, -- NULL = applies to both
    sub_type_code TEXT, -- NULL = applies to all subtypes
    scope slot_scope NOT NULL DEFAULT 'PRINCIPAL',
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    validators JSONB, -- { fileTypes: [], expiryRules: {}, minSize: N }
    help_text TEXT,
    display_order INTEGER DEFAULT 0,
    group_name TEXT, -- For UI grouping
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS slot_definitions_match_idx ON slot_definitions(app_type, processing_context, action_intent);

-- 3.6 Slots (instances per application)
CREATE TABLE IF NOT EXISTS slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL, -- For scoped slots
    slot_definition_id TEXT NOT NULL REFERENCES slot_definitions(id),
    state slot_state NOT NULL DEFAULT 'missing',
    is_required BOOLEAN NOT NULL DEFAULT TRUE, -- Copied from definition but overrideable
    due_at TIMESTAMPTZ,
    meta JSONB, -- rejectionReason, notes, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, application_id, person_id, slot_definition_id)
);

CREATE INDEX IF NOT EXISTS slots_app_idx ON slots(application_id);
CREATE INDEX IF NOT EXISTS slots_state_idx ON slots(application_id, state);

-- 3.7 Document files (immutable file storage)
CREATE TABLE IF NOT EXISTS document_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    sha256 TEXT, -- Optional content hash
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_files_org_idx ON document_files(org_id);

-- 3.8 Document links (relationships - enables reuse)
CREATE TABLE IF NOT EXISTS document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_file_id UUID NOT NULL REFERENCES document_files(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES slots(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active file per slot
CREATE UNIQUE INDEX IF NOT EXISTS document_links_active_slot_idx 
ON document_links(org_id, slot_id) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS document_links_file_idx ON document_links(document_file_id);
CREATE INDEX IF NOT EXISTS document_links_app_idx ON document_links(application_id);

-- 3.9 Work permit attributes (1:1 with applications)
CREATE TABLE IF NOT EXISTS work_permit_attributes (
    application_id UUID PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    program_type program_type,
    authorization_model authorization_model,
    sub_type_code TEXT,
    action_intent action_intent,
    requested_valid_to DATE,
    current_employer_id UUID REFERENCES employers(id) ON DELETE SET NULL,
    position JSONB, -- { noc, teer, title, wage, location }
    authorization_artifact JSONB, -- { kind, refNumber, exemptionCode, expiresAt, complianceFeePaid }
    inside_canada_context JSONB, -- { currentStatusType, currentStatusExpiresAt, lastEntryDate }
    open_basis JSONB, -- { basisCode, policyPack }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 Application evaluations (cached rules engine output)
CREATE TABLE IF NOT EXISTS application_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    derived JSONB, -- { statusExpiryAt, isEligibleForMaintainedStatus, ... }
    deadlines JSONB, -- Array of deadline objects
    blockers JSONB, -- Array of blocker objects
    warnings JSONB, -- Array of warning objects
    slot_plan JSONB, -- Array of required slots
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS application_evaluations_app_idx ON application_evaluations(application_id, evaluated_at DESC);

-- ============================================================================
-- PART 4: RLS POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_permit_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can access data in their organization

-- Persons
CREATE POLICY "Users can access persons in their org" ON persons
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Application participants
CREATE POLICY "Users can access participants in their org" ON application_participants
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Person statuses
CREATE POLICY "Users can access statuses in their org" ON person_statuses
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Case events
CREATE POLICY "Users can access events in their org" ON case_events
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Slot definitions (read-only for all authenticated users - these are templates)
CREATE POLICY "Authenticated users can read slot definitions" ON slot_definitions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Slots
CREATE POLICY "Users can access slots in their org" ON slots
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Document files
CREATE POLICY "Users can access document files in their org" ON document_files
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Document links
CREATE POLICY "Users can access document links in their org" ON document_links
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Work permit attributes
CREATE POLICY "Users can access WP attributes in their org" ON work_permit_attributes
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Application evaluations
CREATE POLICY "Users can access evaluations in their org" ON application_evaluations
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- PART 5: SEED SLOT DEFINITIONS (WP Inside Canada Extend)
-- ============================================================================

INSERT INTO slot_definitions (id, app_type, processing_context, action_intent, scope, is_required, label, group_name, display_order, help_text) VALUES
-- Common slots (all WP INSIDE + EXTEND)
('wp.passport.biopage', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'PRINCIPAL', TRUE, 'Passport Bio Page', 'Identity', 10, 'Clear copy of passport bio page showing photo, name, DOB, and expiry'),
('wp.current_permit.copy', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'PRINCIPAL', TRUE, 'Current Work Permit', 'Current Status', 20, 'Copy of your current work permit'),
('wp.photo.digital', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'PRINCIPAL', FALSE, 'Digital Photo', 'Identity', 15, 'IRCC-compliant digital photo'),
('wp.employment.current_paystubs', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'PRINCIPAL', FALSE, 'Current Paystubs', 'Employment Evidence', 30, 'Recent paystubs showing current employment'),
('wp.employment.employment_letter', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'PRINCIPAL', FALSE, 'Employment Letter', 'Employment Evidence', 31, 'Letter from current employer confirming employment')
ON CONFLICT (id) DO NOTHING;

-- Employer-specific IMP slots
INSERT INTO slot_definitions (id, app_type, processing_context, action_intent, program_type, authorization_model, scope, is_required, label, group_name, display_order, help_text) VALUES
('wp.imp.employer_portal.offer', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'IMP', 'EMPLOYER_SPECIFIC', 'EMPLOYER', TRUE, 'Employer Portal Offer', 'Authorization', 40, 'Offer number from IRCC Employer Portal'),
('wp.imp.compliance_fee', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'IMP', 'EMPLOYER_SPECIFIC', 'EMPLOYER', TRUE, 'Compliance Fee Receipt', 'Authorization', 41, 'Proof of employer compliance fee payment'),
('wp.job_offer.contract', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'IMP', 'EMPLOYER_SPECIFIC', 'EMPLOYER', TRUE, 'Job Offer/Contract', 'Employment', 42, 'Signed employment contract or offer letter')
ON CONFLICT (id) DO NOTHING;

-- Employer-specific TFWP slots
INSERT INTO slot_definitions (id, app_type, processing_context, action_intent, program_type, authorization_model, scope, is_required, label, group_name, display_order, help_text) VALUES
('wp.tfw.lmia.decision', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'TFWP', 'EMPLOYER_SPECIFIC', 'EMPLOYER', TRUE, 'LMIA Decision Letter', 'Authorization', 40, 'Positive LMIA decision letter or number'),
('wp.tfw.job_offer.contract', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'TFWP', 'EMPLOYER_SPECIFIC', 'EMPLOYER', TRUE, 'Job Offer/Contract', 'Employment', 42, 'Signed employment contract or offer letter')
ON CONFLICT (id) DO NOTHING;

-- Open work permit slots
INSERT INTO slot_definitions (id, app_type, processing_context, action_intent, authorization_model, scope, is_required, label, group_name, display_order, help_text) VALUES
('wp.open.eligibility_evidence', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'OPEN', 'PRINCIPAL', TRUE, 'OWP Eligibility Evidence', 'Eligibility', 40, 'Evidence supporting open work permit eligibility (varies by basis)')
ON CONFLICT (id) DO NOTHING;
