CREATE TABLE lp_token_ledger (
    lp_token_id BIGINT PRIMARY KEY,
    user_id INT REFERENCES users(user_id) NOT NULL,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL,
    UNIQUE (user_id, token_id)
);
