-- Canonicalize required WP slots
UPDATE slot_definitions
SET is_required = TRUE
WHERE id IN ('wp.photo.digital', 'wp.current_permit.copy');
