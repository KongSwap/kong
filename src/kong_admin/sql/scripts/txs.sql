CREATE TYPE tx_type AS ENUM ('add_pool', 'add_liquidity', 'remove_liquidity', 'swap', 'send');

CREATE TYPE status AS ENUM ('Success', 'Failed');

CREATE TABLE txs (
    tx_id BIGINT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    tx_type tx_type NOT NULL,
    ts TIMESTAMP NOT NULL
);

CREATE TABLE add_pool_tx (
    tx_id BIGINT PRIMARY KEY,
    pool_id INT NOT NULL,
    user_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    status status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    on_kong BOOLEAN NOT NULL,
    ts TIMESTAMP NOT NULL
);

CREATE TABLE add_liquidity_tx (
    tx_id BIGINT PRIMARY KEY,
    pool_id INT NOT NULL,
    user_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    status status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE remove_liquidity_tx (
    tx_id BIGINT PRIMARY KEY,
    pool_id INT NOT NULL,
    user_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    status status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    lp_fee_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    lp_fee_1 DOUBLE PRECISION NOT NULL,
    remove_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE swap_tx_swap_calc (
    tx_id BIGINT,
    pay_token_id INT NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    lp_fee DOUBLE PRECISION NOT NULL,
    gas_fee DOUBLE PRECISION NOT NULL
);

CREATE TABLE swap_tx (
    tx_id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    request_id BIGINT NOT NULL,
    status status NOT NULL,
    pay_token_id INT NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    mid_price DOUBLE PRECISION NOT NULL,
    slippage DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claims_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);