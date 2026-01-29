-- ========================================================================
-- Migration: Add loop_config column to thread and thread_chat tables
-- ========================================================================
-- This migration adds the loop_config column for the new loop mode feature
-- ========================================================================

-- Add loop_config to thread table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'thread'
          AND column_name = 'loop_config'
    ) THEN
        ALTER TABLE "thread" ADD COLUMN "loop_config" jsonb;
        RAISE NOTICE 'Added loop_config column to thread table';
    ELSE
        RAISE NOTICE 'loop_config column already exists in thread table';
    END IF;
END $$;

-- Add loop_config to thread_chat table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'thread_chat'
          AND column_name = 'loop_config'
    ) THEN
        ALTER TABLE "thread_chat" ADD COLUMN "loop_config" jsonb;
        RAISE NOTICE 'Added loop_config column to thread_chat table';
    ELSE
        RAISE NOTICE 'loop_config column already exists in thread_chat table';
    END IF;
END $$;

-- ========================================================================

-- Verify columns were added
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('thread', 'thread_chat')
  AND column_name = 'loop_config'
ORDER BY table_name;
