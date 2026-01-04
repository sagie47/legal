-- Add uses_new_docs flag to applications
-- This allows per-application opt-in to the new slot-based document system
-- Created: 2025-12-16

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS uses_new_docs BOOLEAN DEFAULT FALSE;

-- Comment: Set to TRUE for new WP extension applications
-- Legacy applications can keep uses_new_docs = FALSE and use the old documents system
COMMENT ON COLUMN applications.uses_new_docs IS 'When TRUE, use slots/document_files/document_links system. When FALSE, use legacy documents table.';
