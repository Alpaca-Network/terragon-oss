-- ============================================================================
-- Migration: Add GatewayZ columns to user table
-- ============================================================================
-- This migration adds the missing columns required for GatewayZ integration:
-- - gw_user_id: GatewayZ user ID for cross-platform identification
-- - gw_tier: GatewayZ subscription tier (free/pro/max)
-- - gw_tier_updated_at: Last time tier was synced from GatewayZ
-- ============================================================================

-- Step 1: Check current state of the user table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user'
  AND column_name IN ('gw_user_id', 'gw_tier', 'gw_tier_updated_at')
ORDER BY column_name;

-- ============================================================================

-- Step 2: Add the missing columns (IF NOT EXISTS is not supported in all PostgreSQL versions)

-- Add gw_user_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user'
          AND column_name = 'gw_user_id'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "gw_user_id" TEXT;
        RAISE NOTICE 'Added gw_user_id column';
    ELSE
        RAISE NOTICE 'gw_user_id column already exists';
    END IF;
END $$;

-- Add gw_tier column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user'
          AND column_name = 'gw_tier'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "gw_tier" TEXT;
        RAISE NOTICE 'Added gw_tier column';
    ELSE
        RAISE NOTICE 'gw_tier column already exists';
    END IF;
END $$;

-- Add gw_tier_updated_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user'
          AND column_name = 'gw_tier_updated_at'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "gw_tier_updated_at" TIMESTAMP;
        RAISE NOTICE 'Added gw_tier_updated_at column';
    ELSE
        RAISE NOTICE 'gw_tier_updated_at column already exists';
    END IF;
END $$;

-- ============================================================================

-- Step 3: Verify the columns were added successfully
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user'
  AND column_name IN ('gw_user_id', 'gw_tier', 'gw_tier_updated_at')
ORDER BY column_name;

-- Expected output should show 3 rows:
-- gw_tier           | text                        | YES
-- gw_tier_updated_at | timestamp without time zone | YES
-- gw_user_id        | text                        | YES

-- ============================================================================
