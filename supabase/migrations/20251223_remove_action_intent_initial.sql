-- Rename legacy INITIAL values to APPLY and remove INITIAL from the enum

DO $$ BEGIN
    ALTER TYPE action_intent ADD VALUE IF NOT EXISTS 'APPLY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE applications
SET action_intent = 'APPLY'
WHERE action_intent::text = 'INITIAL';

UPDATE work_permit_attributes
SET action_intent = 'APPLY'
WHERE action_intent::text = 'INITIAL';

UPDATE slot_definitions
SET action_intent = 'APPLY'
WHERE action_intent::text = 'INITIAL';

DO $$ BEGIN
    CREATE TYPE action_intent_new AS ENUM ('APPLY', 'EXTEND', 'CHANGE_EMPLOYER', 'CHANGE_CONDITIONS', 'RESTORE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE applications
    ALTER COLUMN action_intent TYPE action_intent_new
    USING action_intent::text::action_intent_new;

ALTER TABLE work_permit_attributes
    ALTER COLUMN action_intent TYPE action_intent_new
    USING action_intent::text::action_intent_new;

ALTER TABLE slot_definitions
    ALTER COLUMN action_intent TYPE action_intent_new
    USING action_intent::text::action_intent_new;

DROP TYPE action_intent;

ALTER TYPE action_intent_new RENAME TO action_intent;
