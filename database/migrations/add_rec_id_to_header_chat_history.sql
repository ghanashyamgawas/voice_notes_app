-- Migration: Add rec_id column to header_chat_history table
-- Date: 2025-01-27
-- Description: Adds rec_id column to track which recording the chat is associated with

-- Add rec_id column
ALTER TABLE header_chat_history ADD COLUMN IF NOT EXISTS rec_id TEXT;

-- Add index for rec_id
CREATE INDEX IF NOT EXISTS idx_header_chat_history_rec ON header_chat_history(rec_id);

-- Update comment
COMMENT ON COLUMN header_chat_history.rec_id IS 'Recording ID that this chat is associated with';
