-- Add APPLY to action_intent enum and normalize legacy values
DO $$ BEGIN
    ALTER TYPE action_intent ADD VALUE IF NOT EXISTS 'APPLY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE applications
SET action_intent = 'APPLY'
WHERE action_intent = 'INITIAL';

UPDATE work_permit_attributes
SET action_intent = 'APPLY'
WHERE action_intent = 'INITIAL';
