CREATE TYPE token_type AS ENUM ('IC', 'LP');

CREATE TABLE tokens (
    token_id INT PRIMARY KEY,
    token_type token_type,
    name VARCHAR(64),
    symbol VARCHAR(20),
    canister_id VARCHAR(64),
    address VARCHAR(20),
    decimals SMALLINT,
    fee FLOAT8,
    icrc1 BOOLEAN,
    icrc2 BOOLEAN,
    icrc3 BOOLEAN,
    on_kong BOOLEAN,
    UNIQUE (canister_id, address)
);
