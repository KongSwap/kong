CREATE TABLE lp_token_ledger (
    lp_token_id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    token_id INT NOT NULL,
    amount FLOAT8 NOT NULL,
    ts TIMESTAMP NOT NULL,
    UNIQUE (user_id, token_id)
);
