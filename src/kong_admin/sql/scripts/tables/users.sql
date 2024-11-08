CREATE TABLE users (
    user_id INT PRIMARY KEY,
    principal_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    my_referral_code TEXT NOT NULL,
    referred_by INT,
    referred_by_expires_at TIMESTAMP,
    fee_level SMALLINT,
    fee_level_expires_at TIMESTAMP,
    campaign1_flags BOOLEAN[],
    last_login_ts TIMESTAMP,
    last_swap_ts TIMESTAMP,
    raw_json JSONB NOT NULL,
    UNIQUE (principal_id)
);
