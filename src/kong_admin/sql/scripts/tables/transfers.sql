CREATE TABLE transfers (
    transfer_id BIGINT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    is_send BOOLEAN NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    block_index DOUBLE PRECISION,
    tx_hash TEXT,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);
