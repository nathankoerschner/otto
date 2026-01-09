-- Migration: Remove follow_ups feature
-- Run this migration BEFORE deploying the code changes

BEGIN;

-- 1. Clear any pending follow-up references in conversations
UPDATE conversations
SET pending_follow_up_id = NULL
WHERE pending_follow_up_id IS NOT NULL;

-- 2. Reset conversations stuck in awaiting_follow_up_response state
UPDATE conversations
SET state = 'idle'
WHERE state = 'awaiting_follow_up_response';

-- 3. Drop the foreign key constraint first
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_pending_follow_up_id_fkey;

-- 4. Drop the pending_follow_up_id column
ALTER TABLE conversations DROP COLUMN IF EXISTS pending_follow_up_id;

-- 5. Update the state CHECK constraint to remove awaiting_follow_up_response
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_state_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_state_check
  CHECK (state IN ('idle', 'awaiting_proposition_response', 'in_conversation'));

-- 6. Drop follow_ups indexes
DROP INDEX IF EXISTS idx_follow_ups_task_id;
DROP INDEX IF EXISTS idx_follow_ups_scheduled;

-- 7. Drop follow_ups table
DROP TABLE IF EXISTS follow_ups CASCADE;

COMMIT;
