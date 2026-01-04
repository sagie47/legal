-- Safe Schema Refactor Migration
-- Handles the case where enums may already exist from a previous partial run
-- Created: 2025-12-16

-- ============================================================================
-- PART 1: ENUMS (safe creation - skip if exists)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE app_type AS ENUM ('WORK_PERMIT', 'STUDY_PERMIT', 'VISITOR', 'PR_SPOUSAL', 'EE_PROFILE', 'EE_EAPR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE processing_context AS ENUM ('OUTSIDE_CANADA', 'INSIDE_CANADA', 'PORT_OF_ENTRY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE action_intent AS ENUM ('INITIAL', 'EXTEND', 'CHANGE_EMPLOYER', 'CHANGE_CONDITIONS', 'RESTORE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE program_type AS ENUM ('TFWP', 'IMP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE authorization_model AS ENUM ('EMPLOYER_SPECIFIC', 'OPEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE participant_role AS ENUM ('PRINCIPAL', 'SPOUSE', 'CHILD', 'SPONSOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE immigration_status_type AS ENUM ('WORK_PERMIT', 'STUDY_PERMIT', 'VISITOR', 'TRP', 'PR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE slot_state AS ENUM ('missing', 'uploaded', 'in_review', 'verified', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE slot_scope AS ENUM ('PRINCIPAL', 'SPOUSE', 'EMPLOYER', 'APPLICATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PART 2: NEW COLUMNS ON EXISTING TABLES
-- ============================================================================

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS app_type app_type,
ADD COLUMN IF NOT EXISTS processing_context processing_context,
ADD COLUMN IF NOT EXISTS action_intent action_intent,
ADD COLUMN IF NOT EXISTS program_type program_type,
ADD COLUMN IF NOT EXISTS authorization_model authorization_model,
ADD COLUMN IF NOT EXISTS sub_type_code TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS uses_new_docs BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- PART 3: NEW TABLES (IF NOT EXISTS)
-- ============================================================================

-- Persons table
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    identity JSONB,
    passport JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Application participants
CREATE TABLE IF NOT EXISTS application_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    role participant_role NOT NULL DEFAULT 'PRINCIPAL',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(application_id, person_id, role)
);

-- Person statuses
CREATE TABLE IF NOT EXISTS person_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    status_type TEXT NOT NULL,
    valid_from DATE,
    valid_to DATE,
    is_current BOOLEAN DEFAULT FALSE,
    conditions JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Case events (audit log)
CREATE TABLE IF NOT EXISTS case_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    actor_user_id UUID REFERENCES users(id),
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Slot definitions (template)
CREATE TABLE IF NOT EXISTS slot_definitions (
    id TEXT PRIMARY KEY,
    app_type TEXT NOT NULL,
    processing_context TEXT,
    action_intent TEXT,
    program_type TEXT,
    authorization_model TEXT,
    sub_type_code TEXT,
    scope TEXT NOT NULL DEFAULT 'PRINCIPAL',
    label TEXT NOT NULL,
    group_name TEXT,
    help_text TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Slots (instances)
CREATE TABLE IF NOT EXISTS slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    slot_definition_id TEXT NOT NULL REFERENCES slot_definitions(id),
    person_id UUID REFERENCES persons(id),
    state slot_state NOT NULL DEFAULT 'missing',
    is_required BOOLEAN DEFAULT TRUE,
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(application_id, slot_definition_id, person_id)
);

-- Document files
CREATE TABLE IF NOT EXISTS document_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    hash_sha256 TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Document links
CREATE TABLE IF NOT EXISTS document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_file_id UUID NOT NULL REFERENCES document_files(id) ON DELETE CASCADE,
    slot_id UUID REFERENCES slots(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    linked_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Work permit attributes
CREATE TABLE IF NOT EXISTS work_permit_attributes (
    application_id UUID PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    program_type program_type,
    authorization_model authorization_model,
    sub_type_code TEXT,
    action_intent action_intent,
    requested_valid_to DATE,
    current_employer_id UUID REFERENCES employers(id),
    position JSONB,
    authorization_artifact JSONB,
    inside_canada_context JSONB,
    open_basis JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Application evaluations (cached)
CREATE TABLE IF NOT EXISTS application_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    evaluation_data JSONB NOT NULL,
    evaluated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PART 4: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_persons_org ON persons(org_id);
CREATE INDEX IF NOT EXISTS idx_application_participants_app ON application_participants(application_id);
CREATE INDEX IF NOT EXISTS idx_person_statuses_person ON person_statuses(person_id);
CREATE INDEX IF NOT EXISTS idx_case_events_app ON case_events(application_id);
CREATE INDEX IF NOT EXISTS idx_slots_app ON slots(application_id);
CREATE INDEX IF NOT EXISTS idx_document_files_org ON document_files(org_id);
CREATE INDEX IF NOT EXISTS idx_document_links_slot ON document_links(slot_id);
CREATE INDEX IF NOT EXISTS idx_application_evaluations_app ON application_evaluations(application_id);

-- ============================================================================
-- PART 5: RLS POLICIES
-- ============================================================================

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

-- Create policies (drop first if exists to avoid conflicts)
DROP POLICY IF EXISTS persons_org_policy ON persons;
CREATE POLICY persons_org_policy ON persons FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS application_participants_org_policy ON application_participants;
CREATE POLICY application_participants_org_policy ON application_participants FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS person_statuses_org_policy ON person_statuses;
CREATE POLICY person_statuses_org_policy ON person_statuses FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS case_events_org_policy ON case_events;
CREATE POLICY case_events_org_policy ON case_events FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS slot_definitions_public_read ON slot_definitions;
CREATE POLICY slot_definitions_public_read ON slot_definitions FOR SELECT USING (true);

DROP POLICY IF EXISTS slots_org_policy ON slots;
CREATE POLICY slots_org_policy ON slots FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS document_files_org_policy ON document_files;
CREATE POLICY document_files_org_policy ON document_files FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS document_links_org_policy ON document_links;
CREATE POLICY document_links_org_policy ON document_links FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS work_permit_attributes_org_policy ON work_permit_attributes;
CREATE POLICY work_permit_attributes_org_policy ON work_permit_attributes FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS application_evaluations_org_policy ON application_evaluations;
CREATE POLICY application_evaluations_org_policy ON application_evaluations FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
);

-- ============================================================================
-- PART 6: SEED SLOT DEFINITIONS
-- ============================================================================

INSERT INTO slot_definitions (id, app_type, scope, label, group_name, is_required, display_order)
VALUES
    ('wp.passport.biopage', 'WORK_PERMIT', 'PRINCIPAL', 'Passport Bio Page', 'Identity', true, 1),
    ('wp.passport.stamps', 'WORK_PERMIT', 'PRINCIPAL', 'Passport Stamps (All)', 'Identity', false, 2),
    ('wp.photo', 'WORK_PERMIT', 'PRINCIPAL', 'Digital Photo', 'Identity', true, 3),
    ('wp.status.current', 'WORK_PERMIT', 'PRINCIPAL', 'Current Status Document', 'Status', true, 10),
    ('wp.status.previous', 'WORK_PERMIT', 'PRINCIPAL', 'Previous Permits/Visas', 'Status', false, 11)
ON CONFLICT (id) DO NOTHING;

-- IMP-specific slots
INSERT INTO slot_definitions (id, app_type, program_type, scope, label, group_name, is_required, display_order)
VALUES
    ('wp.imp.offer', 'WORK_PERMIT', 'IMP', 'APPLICATION', 'Employer Portal Offer Letter', 'Authorization', true, 20),
    ('wp.imp.exemption_proof', 'WORK_PERMIT', 'IMP', 'APPLICATION', 'LMIA Exemption Documentation', 'Authorization', false, 21)
ON CONFLICT (id) DO NOTHING;

-- TFWP-specific slots
INSERT INTO slot_definitions (id, app_type, program_type, scope, label, group_name, is_required, display_order)
VALUES
    ('wp.tfwp.lmia', 'WORK_PERMIT', 'TFWP', 'APPLICATION', 'LMIA Approval Letter', 'Authorization', true, 20),
    ('wp.tfwp.contract', 'WORK_PERMIT', 'TFWP', 'APPLICATION', 'Employment Contract', 'Authorization', true, 21)
ON CONFLICT (id) DO NOTHING;

-- Open WP slots
INSERT INTO slot_definitions (id, app_type, authorization_model, scope, label, group_name, is_required, display_order)
VALUES
    ('wp.open.basis_proof', 'WORK_PERMIT', 'OPEN', 'PRINCIPAL', 'Proof of Open WP Eligibility', 'Authorization', true, 20)
ON CONFLICT (id) DO NOTHING;

SELECT 'Migration complete!' as status;
