CREATE TABLE transfers (
    transfer_id BIGINT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    is_send BOOLEAN NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    token_id INT NOT NULL,
    block_index BIGINT,
    tx_hash TEXT,
    ts TIMESTAMP NOT NULL
);
