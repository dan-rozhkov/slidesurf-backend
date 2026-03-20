-- Add index for efficient generation count queries
CREATE INDEX IF NOT EXISTS "user_action_logs_user_action_timestamp_idx" 
ON "user_action_logs" ("user_id", "action_type", "timestamp", "status");

