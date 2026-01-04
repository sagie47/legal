-- Policy Packs (Option B Nuance)
-- Used for effective-dated rules (e.g. SOWP eligibility changes Jan 21, 2025)

CREATE TABLE IF NOT EXISTS policy_packs (
    key TEXT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    rules_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, effective_from)
);

-- Seed Policy Data
-- SOWP (Spouse Open Work Permit) Eligibility
-- Before Jan 21, 2025: Standard rules
INSERT INTO policy_packs (key, effective_from, rules_json)
VALUES (
    'sowp_eligibility',
    '1970-01-01 00:00:00+00',
    '{ "requires_high_wage": false, "requires_degree": false }'
) ON CONFLICT DO NOTHING;

-- From Jan 21, 2025: New rules (High wage or degree required for some streams)
INSERT INTO policy_packs (key, effective_from, rules_json)
VALUES (
    'sowp_eligibility',
    '2025-01-21 00:00:00+00',
    '{ "requires_high_wage": true, "requires_degree": true }'
) ON CONFLICT DO NOTHING;
