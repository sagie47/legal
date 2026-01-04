-- Demote IMP employer-specific evidence slots to optional
UPDATE slot_definitions
SET is_required = FALSE
WHERE id IN ('wp.imp.compliance_fee', 'wp.imp.employer_portal.offer', 'wp.imp.offer');
