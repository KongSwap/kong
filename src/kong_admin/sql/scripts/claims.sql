CREATE TYPE claim_status AS ENUM ('Unclaimed', 'Claiming', 'Claimed');

CREATE TABLE claims (
    claim_id BIGINT PRIMARY KEY,
    user_id INT NOT NULL,
    token_id INT NOT NULL,
    status claim_status NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    request_id BIGINT,
    to_address TEXT,
    attempt_request_id BIGINT[],
    transfer_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);
