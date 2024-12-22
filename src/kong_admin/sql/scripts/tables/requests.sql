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
