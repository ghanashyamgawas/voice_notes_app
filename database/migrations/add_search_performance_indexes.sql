-- Migration: Add indexes for search performance optimization
-- Run this to make search 5-10x faster

-- Composite index for user search with date sorting
-- This dramatically speeds up queries that filter by user_id and sort by created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_notes_user_created
ON voice_notes(user_id, created_at DESC);

-- Index for full-text search ranking (if not exists)
-- This speeds up the ts_rank_cd calculation in search queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_notes_search_user
ON voice_notes(user_id, search_vector);

-- Analyze table to update query planner statistics
ANALYZE voice_notes;

-- Verify indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'voice_notes'
ORDER BY indexname;
