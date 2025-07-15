-- Fix pools table schema to allow NULL values for calculated columns
-- These columns are populated later by separate processes

-- Make tvl column nullable if it isn't already
ALTER TABLE pools ALTER COLUMN tvl DROP NOT NULL;

-- Make rolling_24h columns nullable if they aren't already
ALTER TABLE pools ALTER COLUMN rolling_24h_volume DROP NOT NULL;
ALTER TABLE pools ALTER COLUMN rolling_24h_lp_fee DROP NOT NULL;
ALTER TABLE pools ALTER COLUMN rolling_24h_num_swaps DROP NOT NULL;
ALTER TABLE pools ALTER COLUMN rolling_24h_apy DROP NOT NULL;

-- Add default values for future inserts
ALTER TABLE pools ALTER COLUMN tvl SET DEFAULT NULL;
ALTER TABLE pools ALTER COLUMN rolling_24h_volume SET DEFAULT NULL;
ALTER TABLE pools ALTER COLUMN rolling_24h_lp_fee SET DEFAULT NULL;
ALTER TABLE pools ALTER COLUMN rolling_24h_num_swaps SET DEFAULT NULL;
ALTER TABLE pools ALTER COLUMN rolling_24h_apy SET DEFAULT NULL;