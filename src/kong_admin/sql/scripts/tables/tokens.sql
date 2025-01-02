CREATE TYPE token_type AS ENUM ('IC', 'LP');

CREATE TABLE tokens (
    token_id INT PRIMARY KEY,
    token_type token_type NOT NULL,
    name TEXT,
    symbol TEXT,
    canister_id TEXT,
    address TEXT,
    decimals SMALLINT NOT NULL,
    fee DOUBLE PRECISION,
    icrc1 BOOLEAN,
    icrc2 BOOLEAN,
    icrc3 BOOLEAN,
    is_removed BOOLEAN NOT NULL,
    raw_json JSONB NOT NULL,
    UNIQUE (canister_id, address)
);
