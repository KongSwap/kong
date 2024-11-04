CREATE TYPE request_type AS ENUM ('add_pool', 'add_liquidity', 'remove_liquidity', 'swap', 'claim', 'send');

CREATE TABLE requests (
    request_id BIGINT PRIMARY KEY,
    user_id INT REFERENCES users(user_id) NOT NULL,
    request_type request_type NOT NULL,
    request JSONB NOT NULL,
    reply JSONB NOT NULL,
    statuses JSONB,
    ts TIMESTAMP NOT NULL
);

CREATE TABLE add_pool_args (
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    token_0 TEXT NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    block_index_0 BIGINT,
    hash_0 TEXT,
    token_1 TEXT NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    block_index_1 BIGINT,
    tx_hash_1 TEXT,
    lp_fee_bps SMALLINT,
    kong_fee_bps SMALLINT,
    on_kong BOOLEAN
);

CREATE TABLE add_liquidity_args (
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    token_0 TEXT NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    block_index_0 BIGINT,
    tx_hash_0 TEXT,
    token_1 TEXT NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    block_index_1 BIGINT,
    tx_hash_1 TEXT,
);

CREATE TABLE remove_liquidity_args (
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    token_0 TEXT NOT NULL,
    token_1 TEXT NOT NULL,
    remove_lp_token_amount DOUBLE PRECISION NOT NULL,
);

CREATE TABLE swap_args (
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    pay_token TEXT NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    pay_block_index BIGINT,
    pay_tx_hash TEXT,
    receive_token TEXT NOT NULL,
    receive_amount DOUBLE PRECISION,
    receive_address TEXT,
    max_slippage DOUBLE PRECISION,
    referred_by TEXT
);

CREATE TABLE claim_args (
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    claim_id BIGINT REFERENCES claims(claim_id) NOT NULL
);

CREATE TABLE send_args (
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    token TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    to_address TEXT NOT NULL
);

CREATE TABLE add_pool_reply {
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    tx_id BIGINT REFERENCES txs(tx_id) NOT NULL,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL,
    balance DOUBLE PRECISION NOT NULL,
    chain_0 TEXT NOT NULL,
    symbol_0 TEXT NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    balance_0 DOUBLE PRECISION NOT NULL,
    chain_1 TEXT NOT NULL,
    symbol_1 TEXT NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    balance_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    lp_fee_bps SMALLINT NOT NULL,
    lp_token_symbol TEXT NOT NULL,
    lp_token_supply DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    on_kong BOOLEAN NOT NULL,
    ts TIMESTAMP NOT NULL
};

CREATE TABLE add_liquidity_reply {
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    tx_id BIGINT REFERENCES txs(tx_id) NOT NULL,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL,
    chain_0 TEXT NOT NULL,
    symbol_0 TEXT NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    chain_1 TEXT NOT NULL,
    symbol_1 TEXT NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,    
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    ts TIMESTAMP NOT NULL
}

CREATE TABLE remove_liquidity_reply {
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    tx_id BIGINT REFERENCES txs(tx_id) NOT NULL,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL,
    chain_0 TEXT NOT NULL,
    symbol_0 TEXT NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    lp_fee_0 DOUBLE PRECISION NOT NULL,
    chain_1 TEXT NOT NULL,
    symbol_1 TEXT NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    lp_fee_1 DOUBLE PRECISION NOT NULL,
    remove_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    ts TIMESTAMP NOT NULL
}

CREATE TABLE swap_reply_txs {
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    pay_chain TEXT NOT NULL,
    pay_symbol TEXT NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_chain TEXT NOT NULL,
    receive_symbol TEXT NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    lp_fee DOUBLE PRECISION NOT NULL,
    gas_fee DOUBLE PRECISION NOT NULL,
    ts TIMESTAMP NOT NULL
}

CREATE TABLE swap_reply {
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    tx_id BIGINT REFERENCES txs(tx_id) NOT NULL,
    symbol TEXT NOT NULL,
    status TEXT NOT NULL,
    pay_chain TEXT NOT NULL,
    pay_symbol TEXT NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_chain TEXT NOT NULL,
    receive_symbol TEXT NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    mid_price DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    slippage DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    ts TIMESTAMP NOT NULL
}

CREATE TABLE claim_reply {
    claim_id BIGINT REFERENCES claims(claim_id) PRIMARY KEY,
    status TEXT NOT NULL,
    chain TEXT NOT NULL,
    symbol TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    fee DOUBLE PRECISION NOT NULL,
    to_address TEXT NOT NULL,
    transfer_ids BIGINT[],
    ts TIMESTAMP NOT NULL
}

CREATE TABLE send_reply {
    request_id BIGINT REFERENCES requests(request_id) PRIMARY KEY,
    tx_id BIGINT REFERENCES txs(tx_id) NOT NULL,
    status TEXT NOT NULL,
    chain TEXT NOT NULL,
    symbol TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    to_address TEXT NOT NULL,
    ts TIMESTAMP NOT NULL
}