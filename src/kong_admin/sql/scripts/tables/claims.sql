CREATE TYPE claim_status AS ENUM ('Unclaimed', 'Claiming', 'Claimed', 'TooManyAttempts');

CREATE TABLE claims (
    claim_id BIGINT PRIMARY KEY,
    user_id INT REFERENCES users(user_id) NOT NULL,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    status claim_status NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    request_id BIGINT NOT NULL,
    to_address TEXT,
    attempt_request_id BIGINT[],
    transfer_ids BIGINT[],
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);
