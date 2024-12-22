CREATE TYPE tx_type AS ENUM ('add_pool', 'add_liquidity', 'remove_liquidity', 'swap', 'send');

CREATE TYPE tx_status AS ENUM ('Success', 'Failed');

CREATE TABLE txs (
    tx_id BIGINT PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    tx_type tx_type NOT NULL,
    status tx_status NOT NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);

CREATE TABLE add_pool_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    on_kong BOOLEAN NOT NULL,
    ts TIMESTAMP NOT NULL
);

CREATE TABLE add_liquidity_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE remove_liquidity_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    lp_fee_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    lp_fee_1 DOUBLE PRECISION NOT NULL,
    remove_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE swap_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    pay_token_id INT REFERENCES tokens(token_id) NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT REFERENCES tokens(token_id) NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    mid_price DOUBLE PRECISION NOT NULL,
    slippage DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE swap_pool_tx (
    tx_id BIGINT REFERENCES txs(tx_id) NOT NULL,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    pay_token_id INT REFERENCES tokens(token_id) NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT REFERENCES tokens(token_id) NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    lp_fee DOUBLE PRECISION NOT NULL,
    gas_fee DOUBLE PRECISION NOT NULL
);

CREATE TABLE send_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    to_user_id INT REFERENCES users(user_id) NOT NULL,
    ts TIMESTAMP NOT NULL
);