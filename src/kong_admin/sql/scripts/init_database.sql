-- ============================================================================
-- Kong Admin Database Initialization Script
-- ============================================================================
-- This script creates all necessary tables, types, and indexes for the Kong
-- Admin database in the correct dependency order.
--
-- Usage:
--   psql -U postgres -d kong-apis -f init_database.sql
--
-- Or from the command line:
--   psql -U postgres -d kong-apis < init_database.sql
--
-- ============================================================================

-- Start transaction to ensure all-or-nothing creation
BEGIN;

-- ============================================================================
-- ENUMS / CUSTOM TYPES
-- ============================================================================

-- Token types
CREATE TYPE token_type AS ENUM ('IC', 'LP');

-- Request types
CREATE TYPE request_type AS ENUM ('add_pool', 'add_liquidity', 'remove_liquidity', 'swap', 'claim', 'send');

-- Transaction types and status
CREATE TYPE tx_type AS ENUM ('add_pool', 'add_liquidity', 'remove_liquidity', 'swap', 'send');
CREATE TYPE tx_status AS ENUM ('Success', 'Failed');

-- Claim status
CREATE TYPE claim_status AS ENUM ('Unclaimed', 'Claiming', 'Claimed', 'TooManyAttempts', 'UnclaimedOverride', 'Claimable', 'Expired');

-- ============================================================================
-- BASE TABLES (No Foreign Key Dependencies)
-- ============================================================================

-- Users table
CREATE TABLE users (
    user_id INT PRIMARY KEY,
    principal_id TEXT NOT NULL,
    my_referral_code TEXT NOT NULL,
    referred_by INT,
    referred_by_expires_at TIMESTAMP,
    fee_level SMALLINT,
    fee_level_expires_at TIMESTAMP,
    raw_json JSONB NOT NULL,
    UNIQUE (principal_id)
);

-- Insert default system users
INSERT INTO users (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
VALUES
    (0, 'Anonymous', 'None', NULL, NULL, 0, NULL, '{}'),
    (1, 'All Users', 'None', NULL, NULL, 0, NULL, '{}'),
    (2, 'System', 'None', NULL, NULL, 0, NULL, '{}'),
    (3, 'Claims Timer', 'None', NULL, NULL, 0, NULL, '{}');

-- Tokens table
CREATE TABLE tokens (
    token_id INT PRIMARY KEY,
    token_type token_type NOT NULL,
    name TEXT,
    symbol TEXT,
    canister_id TEXT,
    address TEXT,
    decimals SMALLINT NOT NULL,
    fee DOUBLE PRECISION,
    icrc1 BOOLEAN,
    icrc2 BOOLEAN,
    icrc3 BOOLEAN,
    is_removed BOOLEAN NOT NULL,
    raw_json JSONB NOT NULL,
    UNIQUE (canister_id, address)
);

-- ============================================================================
-- DEPENDENT TABLES (Require tokens and users)
-- ============================================================================

-- Pools table (no foreign keys for data lake usage)
CREATE TABLE pools (
    pool_id INT PRIMARY KEY,
    token_id_0 INT NOT NULL,
    balance_0 DOUBLE PRECISION NOT NULL,
    lp_fee_0 DOUBLE PRECISION NOT NULL,
    kong_fee_0 DOUBLE PRECISION NOT NULL,
    token_id_1 INT NOT NULL,
    balance_1 DOUBLE PRECISION NOT NULL,
    lp_fee_1 DOUBLE PRECISION NOT NULL,
    kong_fee_1 DOUBLE PRECISION NOT NULL,
    lp_fee_bps SMALLINT NOT NULL,
    kong_fee_bps SMALLINT NOT NULL,
    lp_token_id INT NOT NULL,
    rolling_24h_volume DOUBLE PRECISION NULL,
    rolling_24h_lp_fee DOUBLE PRECISION NULL,
    rolling_24h_num_swaps INT NULL,
    rolling_24h_apy DOUBLE PRECISION NULL,
    raw_json JSONB NOT NULL,
    tvl DOUBLE PRECISION NULL,
    is_removed BOOLEAN DEFAULT false NULL
);

-- Create indexes on pools
CREATE INDEX idx_pools_valid_liquidity ON pools USING btree (token_id_0, token_id_1, balance_0, balance_1)
    WHERE ((balance_0 > 0) AND (balance_1 > 0));
CREATE INDEX pools_is_removed_idx ON pools USING btree (is_removed);
CREATE INDEX pools_token_id_0_and_1_idx ON pools USING btree (token_id_0, token_id_1);

-- LP Tokens table (no foreign keys)
CREATE TABLE lp_tokens (
    lp_token_id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    token_id INT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL,
    UNIQUE (user_id, token_id)
);

-- Requests table (no foreign keys)
CREATE TABLE requests (
    request_id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    request_type request_type NOT NULL,
    request JSONB NOT NULL,
    reply JSONB NOT NULL,
    statuses JSONB,
    ts TIMESTAMP NOT NULL
);

-- Create indexes on requests
CREATE INDEX requests_request_type_idx ON requests USING btree (request_type);
CREATE INDEX requests_ts_idx ON requests USING btree (ts);
CREATE INDEX requests_user_id_idx ON requests USING btree (user_id);

-- ============================================================================
-- TABLES DEPENDING ON REQUESTS
-- ============================================================================

-- Claims table (no foreign keys)
CREATE TABLE claims (
    claim_id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    token_id INT NOT NULL,
    status claim_status NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    request_id BIGINT NULL,
    to_address TEXT NULL,
    attempt_request_id BIGINT[] NULL,
    transfer_ids BIGINT[] NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL,
    "desc" TEXT NULL
);

-- Transfers table (no foreign keys)
CREATE TABLE transfers (
    transfer_id BIGINT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    token_id INT NOT NULL,
    is_send BOOLEAN NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    block_index DOUBLE PRECISION NULL,
    tx_hash TEXT NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);

-- Create indexes on transfers
CREATE INDEX transfers_token_id_idx ON transfers USING btree (token_id, request_id);

-- ============================================================================
-- TRANSACTION TABLES
-- ============================================================================

-- Main transactions table (no foreign keys)
CREATE TABLE txs (
    tx_id BIGINT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    tx_type tx_type NOT NULL,
    status tx_status NOT NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);

-- Create indexes on txs
CREATE INDEX idx_txs_ts_casted ON txs USING btree (ts);
CREATE INDEX idx_txs_user_id ON txs USING btree (user_id);
CREATE INDEX txs_status_idx ON txs USING btree (status);
CREATE INDEX txs_tx_type_idx ON txs USING btree (tx_type);

-- Add Pool Transaction table (no foreign keys)
CREATE TABLE add_pool_tx (
    tx_id BIGINT PRIMARY KEY,
    pool_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[] NULL,
    claim_ids BIGINT[] NULL,
    ts TIMESTAMP NOT NULL,
    is_removed BOOLEAN DEFAULT false NULL
);

-- Add Liquidity Transaction table (no foreign keys)
CREATE TABLE add_liquidity_tx (
    tx_id BIGINT PRIMARY KEY,
    pool_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[] NULL,
    claim_ids BIGINT[] NULL,
    ts TIMESTAMP NOT NULL,
    id BIGSERIAL NOT NULL
);

-- Create indexes on add_liquidity_tx
CREATE UNIQUE INDEX add_liquidity_tx_id_idx ON add_liquidity_tx USING btree (id);
CREATE INDEX add_liquidity_tx_pool_id_idx ON add_liquidity_tx USING btree (pool_id);
CREATE INDEX add_liquidity_tx_tx_id_idx ON add_liquidity_tx USING btree (tx_id);
CREATE INDEX add_liquidity_tx_user_id_idx ON add_liquidity_tx USING btree (user_id, pool_id);

-- Remove Liquidity Transaction table (no foreign keys)
CREATE TABLE remove_liquidity_tx (
    tx_id BIGINT PRIMARY KEY,
    pool_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    lp_fee_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    lp_fee_1 DOUBLE PRECISION NOT NULL,
    remove_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[] NULL,
    claim_ids BIGINT[] NULL,
    ts TIMESTAMP NOT NULL
);

-- Swap Transaction table (no foreign keys)
CREATE TABLE swap_tx (
    tx_id BIGINT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    status tx_status NOT NULL,
    pay_token_id INT NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    mid_price DOUBLE PRECISION NOT NULL,
    slippage DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[] NULL,
    claim_ids BIGINT[] NULL,
    ts TIMESTAMP NOT NULL
);

-- Create indexes on swap_tx
CREATE INDEX idx_swap_tx_tokens ON swap_tx USING btree (pay_token_id, receive_token_id);
CREATE INDEX idx_swap_tx_tokens_ts ON swap_tx USING btree (pay_token_id, receive_token_id, ts DESC)
    WHERE ((status = 'Success'::tx_status) AND (pay_amount > 0) AND (receive_amount > 0));

-- Swap Pool Transaction table (individual pool hops within a swap, no foreign keys)
CREATE TABLE swap_pool_tx (
    id BIGSERIAL PRIMARY KEY,
    tx_id BIGINT NOT NULL,
    pool_id INT NOT NULL,
    pay_token_id INT NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    lp_fee DOUBLE PRECISION NOT NULL,
    gas_fee DOUBLE PRECISION NOT NULL,
    ts TIMESTAMP NOT NULL
);

-- Create indexes on swap_pool_tx
CREATE INDEX idx_swap_pool_tx_token_pair ON swap_pool_tx USING btree (pay_token_id, receive_token_id, ts);
CREATE INDEX idx_swap_pool_tx_ts_casted ON swap_pool_tx USING btree (ts);
CREATE INDEX idx_swap_pool_tx_tx_id ON swap_pool_tx USING btree (tx_id);
CREATE INDEX swap_pool_tx_pool_id_idx ON swap_pool_tx USING btree (pool_id);
CREATE INDEX swap_pool_tx_receive_token_id_idx ON swap_pool_tx USING btree (receive_token_id, pay_token_id, ts);

-- Send Transaction table (no foreign keys)
CREATE TABLE send_tx (
    tx_id BIGINT PRIMARY KEY,
    token_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    status tx_status NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    to_user_id INT NOT NULL,
    ts TIMESTAMP NOT NULL
);

-- Create indexes on send_tx
CREATE INDEX send_tx_to_user_id_idx ON send_tx USING btree (to_user_id);
CREATE INDEX send_tx_token_id_idx ON send_tx USING btree (token_id);
CREATE INDEX send_tx_user_id_idx ON send_tx USING btree (user_id);

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all created tables
SELECT
    tablename AS table_name,
    schemaname AS schema_name
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count tables created
SELECT
    COUNT(*) AS total_tables_created
FROM pg_tables
WHERE schemaname = 'public';

-- List all custom types
SELECT
    typname AS type_name,
    typtype AS type_type
FROM pg_type
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e'
ORDER BY typname;
