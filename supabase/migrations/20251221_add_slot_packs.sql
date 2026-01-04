-- Slot packs (Option B)
CREATE TABLE IF NOT EXISTS slot_packs (
    id TEXT PRIMARY KEY,
    app_type TEXT NOT NULL,
    processing_context TEXT,
    action_intent TEXT,
    program_type TEXT,
    authorization_model TEXT,
    sub_type_code TEXT,
    match_predicates JSONB,
    label TEXT NOT NULL,
    is_base BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS slot_packs_match_idx
    ON slot_packs(app_type, processing_context, action_intent);

CREATE TABLE IF NOT EXISTS slot_pack_items (
    pack_id TEXT NOT NULL REFERENCES slot_packs(id) ON DELETE CASCADE,
    slot_definition_id TEXT NOT NULL REFERENCES slot_definitions(id) ON DELETE CASCADE,
    is_required_override BOOLEAN,
    display_order INT,
    PRIMARY KEY (pack_id, slot_definition_id)
);

CREATE INDEX IF NOT EXISTS slot_pack_items_pack_idx ON slot_pack_items(pack_id);

-- Seed packs for WP Inside Canada Extend
INSERT INTO slot_packs (
    id, label, app_type, processing_context, action_intent,
    program_type, authorization_model, sub_type_code, match_predicates, is_base
)
VALUES
    ('wp.inside.extend.base', 'WP Inside Canada Extend Base', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', NULL, NULL, NULL, NULL, TRUE),
    ('wp.inside.extend.open', 'WP Inside Canada Extend Open', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', NULL, 'OPEN', NULL, NULL, FALSE),
    ('wp.inside.extend.imp.employer_specific', 'WP Inside Canada Extend IMP Employer Specific', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'IMP', 'EMPLOYER_SPECIFIC', NULL, NULL, FALSE),
    ('wp.inside.extend.tfw.employer_specific', 'WP Inside Canada Extend TFW Employer Specific', 'WORK_PERMIT', 'INSIDE_CANADA', 'EXTEND', 'TFWP', 'EMPLOYER_SPECIFIC', NULL, NULL, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Base pack items
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.base', id, TRUE, 10
FROM slot_definitions WHERE id = 'wp.passport.biopage'
ON CONFLICT DO NOTHING;

INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.base', id, TRUE, 20
FROM slot_definitions WHERE id = 'wp.current_permit.copy'
ON CONFLICT DO NOTHING;

INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.base', id, TRUE, 15
FROM slot_definitions WHERE id = 'wp.photo.digital'
ON CONFLICT DO NOTHING;

INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.base', id, FALSE, 30
FROM slot_definitions WHERE id = 'wp.employment.current_paystubs'
ON CONFLICT DO NOTHING;

INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.base', id, FALSE, 31
FROM slot_definitions WHERE id = 'wp.employment.employment_letter'
ON CONFLICT DO NOTHING;

-- Open permit pack items
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.open', id, TRUE, 40
FROM slot_definitions WHERE id = 'wp.open.eligibility_evidence'
ON CONFLICT DO NOTHING;

-- IMP employer-specific pack items (offer/compliance evidence optional)
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.imp.employer_specific', id, TRUE, 42
FROM slot_definitions WHERE id = 'wp.job_offer.contract'
ON CONFLICT DO NOTHING;

INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.imp.employer_specific', id, FALSE, 41
FROM slot_definitions WHERE id = 'wp.imp.compliance_fee'
ON CONFLICT DO NOTHING;

INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.imp.employer_specific', id, FALSE, 40
FROM slot_definitions WHERE id = 'wp.imp.employer_portal.offer'
ON CONFLICT DO NOTHING;

-- TFWP employer-specific pack items
INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.tfw.employer_specific', id, TRUE, 40
FROM slot_definitions WHERE id = 'wp.tfw.lmia.decision'
ON CONFLICT DO NOTHING;

INSERT INTO slot_pack_items (pack_id, slot_definition_id, is_required_override, display_order)
SELECT 'wp.inside.extend.tfw.employer_specific', id, TRUE, 42
FROM slot_definitions WHERE id = 'wp.tfw.job_offer.contract'
ON CONFLICT DO NOTHING;
