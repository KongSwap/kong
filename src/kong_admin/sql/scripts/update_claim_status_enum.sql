-- Migration to update claim_status enum type with new values
-- This adds 'UnclaimedOverride' and 'Claimable' to the existing enum

-- First, we need to rename the old type and create a new one
-- PostgreSQL doesn't allow direct modification of enum types

BEGIN;

-- Create a new enum type with all values
CREATE TYPE public."claim_status_new" AS ENUM (
    'Unclaimed',
    'Claiming',
    'Claimed',
    'TooManyAttempts',
    'UnclaimedOverride',
    'Claimable'
);

-- Update all columns that use the old enum to use the new one
-- You'll need to update these table/column names based on your actual schema
DO $$ 
DECLARE
    r record;
BEGIN
    -- Find all columns using the old claim_status type
    FOR r IN 
        SELECT 
            table_schema,
            table_name,
            column_name
        FROM information_schema.columns
        WHERE udt_name = 'claim_status'
        AND table_schema = 'public'
    LOOP
        -- Cast the column to text, then to the new enum type
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE public."claim_status_new" USING %I::text::public."claim_status_new"',
            r.table_schema,
            r.table_name,
            r.column_name,
            r.column_name
        );
    END LOOP;
END $$;

-- Drop the old type
DROP TYPE public."claim_status";

-- Rename the new type to the original name
ALTER TYPE public."claim_status_new" RENAME TO "claim_status";

COMMIT;

-- Rollback script (save this separately)
-- BEGIN;
-- CREATE TYPE public."claim_status_old" AS ENUM ('Unclaimed', 'Claiming', 'Claimed', 'TooManyAttempts');
-- -- Update columns back to old type (adjust table/column names)
-- DO $$ 
-- DECLARE
--     r record;
-- BEGIN
--     FOR r IN 
--         SELECT table_schema, table_name, column_name
--         FROM information_schema.columns
--         WHERE udt_name = 'claim_status'
--         AND table_schema = 'public'
--     LOOP
--         EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE public."claim_status_old" USING 
--             CASE %I::text
--                 WHEN ''UnclaimedOverride'' THEN ''Unclaimed''::public."claim_status_old"
--                 WHEN ''Claimable'' THEN ''Unclaimed''::public."claim_status_old"
--                 ELSE %I::text::public."claim_status_old"
--             END',
--             r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name
--         );
--     END LOOP;
-- END $$;
-- DROP TYPE public."claim_status";
-- ALTER TYPE public."claim_status_old" RENAME TO "claim_status";
-- COMMIT;