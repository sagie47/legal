-- Add Outside Canada context to work_permit_attributes
ALTER TABLE work_permit_attributes
    ADD COLUMN IF NOT EXISTS outside_canada_context JSONB;
