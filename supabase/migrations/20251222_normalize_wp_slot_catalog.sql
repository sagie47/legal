-- Normalize WP slot catalog and packs (canonical IDs + base/conditional packs)

-- =============================================================================
-- CANONICAL SLOT DEFINITIONS
-- =============================================================================

INSERT INTO slot_definitions (
    id,
    app_type,
    scope,
    label,
    group_name,
    help_text,
    is_required,
    display_order
) VALUES
    -- Identity & Travel
    ('wp.passport.biopage', 'WORK_PERMIT', 'PRINCIPAL', 'Passport Biopage', 'Identity & Travel', NULL, FALSE, 10),
    ('wp.passport.stamps_visas', 'WORK_PERMIT', 'PRINCIPAL', 'Passport Stamps and Visas', 'Identity & Travel', NULL, FALSE, 20),
    ('wp.photo.digital', 'WORK_PERMIT', 'PRINCIPAL', 'Digital Photo', 'Identity & Travel', NULL, FALSE, 30),
    ('wp.resume.cv', 'WORK_PERMIT', 'PRINCIPAL', 'Resume/CV', 'Identity & Travel', NULL, FALSE, 40),

    -- Status & Context
    ('wp.status.current', 'WORK_PERMIT', 'PRINCIPAL', 'Current Status Document', 'Status & Context', NULL, FALSE, 50),
    ('wp.current_permit.copy', 'WORK_PERMIT', 'PRINCIPAL', 'Current Permit Copy', 'Status & Context', NULL, FALSE, 60),

    -- Civil Status & Relationships
    ('wp.identity.birth_certificate', 'WORK_PERMIT', 'PRINCIPAL', 'Birth Certificate', 'Civil Status & Relationships', NULL, FALSE, 70),
    ('wp.identity.marriage_certificate', 'WORK_PERMIT', 'PRINCIPAL', 'Marriage Certificate', 'Civil Status & Relationships', NULL, FALSE, 80),
    ('wp.identity.divorce_certificate', 'WORK_PERMIT', 'PRINCIPAL', 'Divorce Certificate', 'Civil Status & Relationships', NULL, FALSE, 90),
    ('wp.identity.name_change', 'WORK_PERMIT', 'PRINCIPAL', 'Name Change Document', 'Civil Status & Relationships', NULL, FALSE, 100),
    ('wp.relationship.common_law_evidence', 'WORK_PERMIT', 'PRINCIPAL', 'Common-law Evidence', 'Civil Status & Relationships', NULL, FALSE, 110),

    -- Education & Funds
    ('wp.education.diploma', 'WORK_PERMIT', 'PRINCIPAL', 'Diploma or Certificate', 'Education & Funds', NULL, FALSE, 120),
    ('wp.proof.funds', 'WORK_PERMIT', 'PRINCIPAL', 'Proof of Funds', 'Education & Funds', NULL, FALSE, 130),

    -- Police & Medical
    ('wp.police.certificate', 'WORK_PERMIT', 'PRINCIPAL', 'Police Certificate', 'Police & Medical', NULL, FALSE, 140),
    ('wp.medical.exam', 'WORK_PERMIT', 'PRINCIPAL', 'Medical Exam', 'Police & Medical', NULL, FALSE, 150),

    -- Letters & Explanation
    ('wp.letter.explanation', 'WORK_PERMIT', 'PRINCIPAL', 'Letter of Explanation', 'Letters & Explanation', NULL, FALSE, 160),

    -- Employment Evidence
    ('wp.employment.employment_letter', 'WORK_PERMIT', 'PRINCIPAL', 'Employment Letter', 'Employment Evidence', NULL, FALSE, 170),
    ('wp.employment.current_paystubs', 'WORK_PERMIT', 'PRINCIPAL', 'Current Paystubs', 'Employment Evidence', NULL, FALSE, 180),

    -- Authorization (Employer/Program)
    ('wp.job_offer.contract', 'WORK_PERMIT', 'EMPLOYER', 'Job Offer or Contract', 'Authorization (Employer/Program)', NULL, FALSE, 190),
    ('wp.open.eligibility_evidence', 'WORK_PERMIT', 'PRINCIPAL', 'Open Permit Eligibility Evidence', 'Authorization (Employer/Program)', NULL, FALSE, 200),
    ('wp.imp.employer_portal.offer', 'WORK_PERMIT', 'EMPLOYER', 'Employer Portal Offer', 'Authorization (Employer/Program)', NULL, FALSE, 210),
    ('wp.imp.compliance_fee', 'WORK_PERMIT', 'EMPLOYER', 'Employer Compliance Fee Receipt', 'Authorization (Employer/Program)', NULL, FALSE, 220),
    ('wp.imp.exemption_proof', 'WORK_PERMIT', 'EMPLOYER', 'IMP Exemption Proof', 'Authorization (Employer/Program)', NULL, FALSE, 230),
    ('wp.tfw.lmia.decision', 'WORK_PERMIT', 'EMPLOYER', 'LMIA Decision Letter', 'Authorization (Employer/Program)', NULL, FALSE, 240),

    -- Outside Canada
    ('wp.outside.legal_status_residence_country', 'WORK_PERMIT', 'PRINCIPAL', 'Legal Status in Country of Residence', 'Status & Context', NULL, FALSE, 250)
ON CONFLICT (id) DO UPDATE SET
    app_type = EXCLUDED.app_type,
    scope = EXCLUDED.scope,
    label = EXCLUDED.label,
    group_name = EXCLUDED.group_name,
    help_text = EXCLUDED.help_text,
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order;

-- =============================================================================
-- REPLACE OLD PACKS WITH CANONICAL PACKS
-- =============================================================================

DELETE FROM slot_packs
WHERE id IN (
    'wp.inside.extend.base',
    'wp.inside.extend.open',
    'wp.inside.extend.imp.employer_specific',
    'wp.inside.extend.tfw.employer_specific'
);

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
)
VALUES
    ('wp.base.inside', 'WP Inside Canada Base', 'WORK_PERMIT', 'INSIDE_CANADA', NULL, NULL, NULL, NULL, NULL, TRUE),
    ('wp.base.outside', 'WP Outside Canada Base', 'WORK_PERMIT', 'OUTSIDE_CANADA', NULL, NULL, NULL, NULL, NULL, TRUE),
    ('wp.conditional.open', 'WP Open Permit Evidence', 'WORK_PERMIT', NULL, NULL, NULL, 'OPEN', NULL, NULL, FALSE),
    ('wp.conditional.employer_specific.imp', 'WP IMP Employer Specific Evidence', 'WORK_PERMIT', NULL, NULL, 'IMP', 'EMPLOYER_SPECIFIC', NULL, NULL, FALSE),
    ('wp.conditional.employer_specific.tfw', 'WP TFWP Employer Specific Evidence', 'WORK_PERMIT', NULL, NULL, 'TFWP', 'EMPLOYER_SPECIFIC', NULL, NULL, FALSE),
    ('wp.conditional.outside.legal_status', 'WP Outside Legal Status', 'WORK_PERMIT', 'OUTSIDE_CANADA', NULL, NULL, NULL, NULL, '{"requiresLegalStatusDoc": true}', FALSE)
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
    'wp.base.inside',
    'wp.base.outside',
    'wp.conditional.open',
    'wp.conditional.employer_specific.imp',
    'wp.conditional.employer_specific.tfw',
    'wp.conditional.outside.legal_status'
);

-- Base INSIDE pack items
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('wp.base.inside', 'wp.passport.biopage', TRUE, 10),
    ('wp.base.inside', 'wp.photo.digital', TRUE, 20),
    ('wp.base.inside', 'wp.status.current', TRUE, 30),
    ('wp.base.inside', 'wp.current_permit.copy', TRUE, 40),
    ('wp.base.inside', 'wp.passport.stamps_visas', FALSE, 50),
    ('wp.base.inside', 'wp.letter.explanation', FALSE, 60);

-- Base OUTSIDE pack items
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('wp.base.outside', 'wp.passport.biopage', TRUE, 10),
    ('wp.base.outside', 'wp.photo.digital', TRUE, 20),
    ('wp.base.outside', 'wp.status.current', TRUE, 30),
    ('wp.base.outside', 'wp.passport.stamps_visas', FALSE, 40),
    ('wp.base.outside', 'wp.letter.explanation', FALSE, 50);

-- OPEN permit evidence (optional for now)
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('wp.conditional.open', 'wp.open.eligibility_evidence', FALSE, 10);

-- IMP employer-specific evidence
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('wp.conditional.employer_specific.imp', 'wp.job_offer.contract', TRUE, 10),
    ('wp.conditional.employer_specific.imp', 'wp.imp.employer_portal.offer', FALSE, 20),
    ('wp.conditional.employer_specific.imp', 'wp.imp.compliance_fee', FALSE, 30),
    ('wp.conditional.employer_specific.imp', 'wp.imp.exemption_proof', FALSE, 40);

-- TFWP employer-specific evidence
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('wp.conditional.employer_specific.tfw', 'wp.job_offer.contract', TRUE, 10),
    ('wp.conditional.employer_specific.tfw', 'wp.tfw.lmia.decision', TRUE, 20);

-- Outside legal status
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order) VALUES
    ('wp.conditional.outside.legal_status', 'wp.outside.legal_status_residence_country', TRUE, 10);

-- =============================================================================
-- SOFT-RETIRE DUPLICATE/DEPRECATED SLOT INSTANCES
-- =============================================================================

UPDATE slots
SET is_required = FALSE,
    meta = jsonb_strip_nulls(
        COALESCE(meta, '{}'::jsonb) ||
        jsonb_build_object(
            'retiredAt', NOW(),
            'retiredReason', 'catalog_dedupe',
            'replacedBy', 'wp.status.current'
        )
    ),
    updated_at = NOW()
WHERE slot_definition_id = 'wp.entry_record.last'
  AND (meta->>'retiredAt') IS NULL;

UPDATE slots
SET is_required = FALSE,
    meta = jsonb_strip_nulls(
        COALESCE(meta, '{}'::jsonb) ||
        jsonb_build_object(
            'retiredAt', NOW(),
            'retiredReason', 'catalog_dedupe',
            'replacedBy', 'wp.imp.employer_portal.offer'
        )
    ),
    updated_at = NOW()
WHERE slot_definition_id = 'wp.imp.offer'
  AND (meta->>'retiredAt') IS NULL;

UPDATE slots
SET is_required = FALSE,
    meta = jsonb_strip_nulls(
        COALESCE(meta, '{}'::jsonb) ||
        jsonb_build_object(
            'retiredAt', NOW(),
            'retiredReason', 'catalog_dedupe',
            'replacedBy', 'wp.job_offer.contract'
        )
    ),
    updated_at = NOW()
WHERE slot_definition_id = 'wp.tfw.job_offer.contract'
  AND (meta->>'retiredAt') IS NULL;
