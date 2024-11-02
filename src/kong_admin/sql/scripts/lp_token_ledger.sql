CREATE TABLE lp_token_ledger (
    lp_token_id INT PRIMARY KEY,
    user_id INT NOT NULL,
    token_id INT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    ts TIMESTAMP NOT NULL,
    UNIQUE (user_id, token_id)
);
