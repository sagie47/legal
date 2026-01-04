-- Study Permit schema, slot catalog, and OCR target updates

-- ============================================================================
-- STUDY PERMIT ATTRIBUTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS study_permit_attributes (
    application_id UUID PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    program JSONB, -- { dliNumber, institutionName, campusCity, credentialLevel, programName, startDate, endDate, tuitionFirstYear, deliveryMode }
    outside_canada_context JSONB, -- { countryOfResidence, countryOfCitizenship }
    inside_canada_context JSONB, -- { currentStatusType, currentStatusExpiresAt, lastEntryDate }
    family_context JSONB, -- { hasAccompanyingSpouse, hasAccompanyingDependents }
    pal_tal JSONB, -- { required, provinceOrTerritory, documentProvided }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_permit_attributes_org_idx
    ON study_permit_attributes(org_id);

ALTER TABLE study_permit_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access SP attributes in their org" ON study_permit_attributes
    FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- FACT PROPOSALS: ADD STUDY PERMIT TARGET ENTITY
-- ============================================================================

ALTER TABLE fact_proposals
    DROP CONSTRAINT IF EXISTS fact_proposals_target_entity_type_check;

ALTER TABLE fact_proposals
    ADD CONSTRAINT fact_proposals_target_entity_type_check
    CHECK (target_entity_type IN ('person', 'person_status', 'work_permit_attributes', 'study_permit_attributes', 'employer'));

-- ============================================================================
-- STUDY PERMIT SLOT DEFINITIONS
-- ============================================================================

INSERT INTO slot_definitions (
    id,
    app_type,
    scope,
    label,
    group_name,
    help_text,
    is_required,
    display_order,
    extraction_profile
) VALUES
    ('sp.passport.biopage', 'STUDY_PERMIT', 'PRINCIPAL', 'Passport Biopage', 'Identity & Travel', NULL, FALSE, 10, 'passport_v1'),
    ('sp.passport.stamps_visas', 'STUDY_PERMIT', 'PRINCIPAL', 'Passport Stamps and Visas', 'Identity & Travel', NULL, FALSE, 20, NULL),
    ('sp.photo.digital', 'STUDY_PERMIT', 'PRINCIPAL', 'Digital Photo', 'Identity & Travel', NULL, FALSE, 30, NULL),
    ('sp.loa', 'STUDY_PERMIT', 'PRINCIPAL', 'Letter of Acceptance (LOA)', 'Program & Acceptance', NULL, FALSE, 40, 'sp_loa_v1'),
    ('sp.pal_tal', 'STUDY_PERMIT', 'PRINCIPAL', 'PAL/TAL Document', 'PAL/TAL', 'Provincial or Territorial Attestation Letter', FALSE, 45, NULL),
    ('sp.proof.funds', 'STUDY_PERMIT', 'PRINCIPAL', 'Proof of Funds', 'Financial', NULL, FALSE, 50, NULL),
    ('sp.letter.explanation', 'STUDY_PERMIT', 'PRINCIPAL', 'Letter of Explanation / Study Plan', 'Letters & Explanation', NULL, FALSE, 60, NULL),
    ('sp.current_permit.copy', 'STUDY_PERMIT', 'PRINCIPAL', 'Current Study Permit Copy', 'Status & Enrollment', NULL, FALSE, 70, 'sp_current_permit_v1'),
    ('sp.enrollment.letter', 'STUDY_PERMIT', 'PRINCIPAL', 'Proof of Enrollment Letter', 'Status & Enrollment', NULL, FALSE, 80, NULL),
    ('sp.transcripts', 'STUDY_PERMIT', 'PRINCIPAL', 'Transcripts', 'Status & Enrollment', NULL, FALSE, 90, NULL),
    ('sp.restore.explanation', 'STUDY_PERMIT', 'PRINCIPAL', 'Restoration Explanation', 'Restoration', NULL, FALSE, 100, NULL),
    ('sp.minor.custodianship', 'STUDY_PERMIT', 'PRINCIPAL', 'Custodianship Documents', 'Minor Applicant', NULL, FALSE, 110, NULL),
    ('sp.minor.parent_consent', 'STUDY_PERMIT', 'PRINCIPAL', 'Parent/Guardian Consent', 'Minor Applicant', NULL, FALSE, 120, NULL),
    ('sp.family.relationship_evidence', 'STUDY_PERMIT', 'PRINCIPAL', 'Marriage Certificate or Common-law Evidence', 'Family & Dependents', NULL, FALSE, 130, NULL),
    ('sp.family.dependent_birth_certificates', 'STUDY_PERMIT', 'PRINCIPAL', 'Dependent Birth Certificates', 'Family & Dependents', NULL, FALSE, 140, NULL)
ON CONFLICT (id) DO UPDATE SET
    app_type = EXCLUDED.app_type,
    scope = EXCLUDED.scope,
    label = EXCLUDED.label,
    group_name = EXCLUDED.group_name,
    help_text = EXCLUDED.help_text,
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order,
    extraction_profile = EXCLUDED.extraction_profile;

-- ============================================================================
-- STUDY PERMIT SLOT PACKS
-- ============================================================================

INSERT INTO slot_packs (
    id,
    label,
    app_type,
    processing_context,
    action_intent,
    program_type,
    authorization_model,
    sub_type_code,
    match_predicates,
    is_base
) VALUES
    ('sp.base.outside.apply', 'SP Outside Canada Apply Base', 'STUDY_PERMIT', 'OUTSIDE_CANADA', 'APPLY', NULL, NULL, NULL, NULL, TRUE),
    ('sp.base.inside', 'SP Inside Canada Base', 'STUDY_PERMIT', 'INSIDE_CANADA', NULL, NULL, NULL, NULL, NULL, TRUE),
    ('sp.conditional.restore', 'SP Restoration Explanation', 'STUDY_PERMIT', 'INSIDE_CANADA', 'RESTORE', NULL, NULL, NULL, NULL, FALSE),
    ('sp.conditional.pal_tal', 'SP PAL/TAL Required', 'STUDY_PERMIT', 'OUTSIDE_CANADA', 'APPLY', NULL, NULL, NULL, '{"requiresPalTal": true}', FALSE),
    ('sp.conditional.minor', 'SP Minor Applicant', 'STUDY_PERMIT', NULL, NULL, NULL, NULL, NULL, '{"requiresMinorApplicant": true}', FALSE),
    ('sp.conditional.spouse', 'SP Accompanying Spouse', 'STUDY_PERMIT', NULL, NULL, NULL, NULL, NULL, '{"requiresSpouse": true}', FALSE),
    ('sp.conditional.dependents', 'SP Accompanying Dependents', 'STUDY_PERMIT', NULL, NULL, NULL, NULL, NULL, '{"requiresDependents": true}', FALSE)
ON CONFLICT (id) DO UPDATE SET
    label = EXCLUDED.label,
    app_type = EXCLUDED.app_type,
    processing_context = EXCLUDED.processing_context,
    action_intent = EXCLUDED.action_intent,
    program_type = EXCLUDED.program_type,
    authorization_model = EXCLUDED.authorization_model,
    sub_type_code = EXCLUDED.sub_type_code,
    match_predicates = EXCLUDED.match_predicates,
    is_base = EXCLUDED.is_base;

DELETE FROM slot_pack_items
WHERE pack_id IN (
    'sp.base.outside.apply',
    'sp.base.inside',
    'sp.conditional.restore',
    'sp.conditional.pal_tal',
    'sp.conditional.minor',
    'sp.conditional.spouse',
    'sp.conditional.dependents'
);

-- Outside Canada APPLY base pack items
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('sp.base.outside.apply', 'sp.passport.biopage', TRUE, 10),
    ('sp.base.outside.apply', 'sp.photo.digital', TRUE, 20),
    ('sp.base.outside.apply', 'sp.passport.stamps_visas', FALSE, 30),
    ('sp.base.outside.apply', 'sp.loa', TRUE, 40),
    ('sp.base.outside.apply', 'sp.proof.funds', TRUE, 50),
    ('sp.base.outside.apply', 'sp.letter.explanation', TRUE, 60);

-- Inside Canada base pack items
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('sp.base.inside', 'sp.current_permit.copy', TRUE, 10),
    ('sp.base.inside', 'sp.enrollment.letter', TRUE, 20),
    ('sp.base.inside', 'sp.proof.funds', TRUE, 30),
    ('sp.base.inside', 'sp.letter.explanation', TRUE, 40),
    ('sp.base.inside', 'sp.transcripts', FALSE, 50),
    ('sp.base.inside', 'sp.passport.biopage', FALSE, 60);

-- Restoration explanation (inside Canada)
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('sp.conditional.restore', 'sp.restore.explanation', TRUE, 5);

-- PAL/TAL required (outside Canada)
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('sp.conditional.pal_tal', 'sp.pal_tal', TRUE, 45);

-- Minor applicant pack
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('sp.conditional.minor', 'sp.minor.custodianship', TRUE, 10),
    ('sp.conditional.minor', 'sp.minor.parent_consent', TRUE, 20);

-- Accompanying spouse pack
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('sp.conditional.spouse', 'sp.family.relationship_evidence', TRUE, 10);

-- Accompanying dependents pack
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('sp.conditional.dependents', 'sp.family.dependent_birth_certificates', TRUE, 10);
