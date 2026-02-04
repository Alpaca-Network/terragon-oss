-- ============================================================================
-- Migration: Rename gatewayz/code-router models to gatewayz:code: format
-- ============================================================================
-- This migration updates stored model names from the old format to the new format:
--   gatewayz/code-router        -> gatewayz:code:balanced
--   gatewayz/code-router/price  -> gatewayz:code:price
--   gatewayz/code-router/quality -> gatewayz:code:performance
--
-- Affected tables:
--   - thread: selected_model column
--   - thread: selected_models JSONB column
--   - user_settings: agent_model_preferences JSONB column
-- ============================================================================

-- Step 1: Preview affected rows in thread table (selected_model column)
SELECT id, selected_model
FROM thread
WHERE selected_model IN (
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
);

-- Step 2: Preview affected rows in thread table (selected_models JSONB column)
SELECT id, selected_models
FROM thread
WHERE selected_models ?| ARRAY[
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
];

-- Step 3: Preview affected rows in user_settings table (agent_model_preferences JSONB column)
SELECT id, user_id, agent_model_preferences
FROM user_settings
WHERE agent_model_preferences->'models' ?| ARRAY[
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
];

-- ============================================================================
-- MIGRATION STATEMENTS
-- ============================================================================

-- Step 4: Update thread.selected_model column
UPDATE thread
SET selected_model = CASE selected_model
    WHEN 'gatewayz/code-router' THEN 'gatewayz:code:balanced'
    WHEN 'gatewayz/code-router/price' THEN 'gatewayz:code:price'
    WHEN 'gatewayz/code-router/quality' THEN 'gatewayz:code:performance'
    ELSE selected_model
END
WHERE selected_model IN (
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
);

-- Step 5: Update thread.selected_models JSONB column
-- Rename keys in the JSONB object
UPDATE thread
SET selected_models = (
    SELECT jsonb_object_agg(
        CASE key
            WHEN 'gatewayz/code-router' THEN 'gatewayz:code:balanced'
            WHEN 'gatewayz/code-router/price' THEN 'gatewayz:code:price'
            WHEN 'gatewayz/code-router/quality' THEN 'gatewayz:code:performance'
            ELSE key
        END,
        value
    )
    FROM jsonb_each(selected_models)
)
WHERE selected_models ?| ARRAY[
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
];

-- Step 6: Update user_settings.agent_model_preferences JSONB column
-- Rename keys in the models object within agent_model_preferences
UPDATE user_settings
SET agent_model_preferences = jsonb_set(
    agent_model_preferences,
    '{models}',
    (
        SELECT jsonb_object_agg(
            CASE key
                WHEN 'gatewayz/code-router' THEN 'gatewayz:code:balanced'
                WHEN 'gatewayz/code-router/price' THEN 'gatewayz:code:price'
                WHEN 'gatewayz/code-router/quality' THEN 'gatewayz:code:performance'
                ELSE key
            END,
            value
        )
        FROM jsonb_each(agent_model_preferences->'models')
    )
)
WHERE agent_model_preferences->'models' ?| ARRAY[
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
];

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Step 7: Verify no old model names remain in thread.selected_model
SELECT COUNT(*) as remaining_old_models_in_thread
FROM thread
WHERE selected_model IN (
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
);
-- Expected: 0

-- Step 8: Verify no old model names remain in thread.selected_models
SELECT COUNT(*) as remaining_old_models_in_selected_models
FROM thread
WHERE selected_models ?| ARRAY[
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
];
-- Expected: 0

-- Step 9: Verify no old model names remain in user_settings.agent_model_preferences
SELECT COUNT(*) as remaining_old_models_in_preferences
FROM user_settings
WHERE agent_model_preferences->'models' ?| ARRAY[
    'gatewayz/code-router',
    'gatewayz/code-router/price',
    'gatewayz/code-router/quality'
];
-- Expected: 0

-- ============================================================================
