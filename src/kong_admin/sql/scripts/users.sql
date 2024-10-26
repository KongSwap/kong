CREATE TABLE users (
    user_id INT PRIMARY KEY,
    principal_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(48) NOT NULL,
    my_referral_code VARCHAR(8) NOT NULL,
    referred_by INT,
    referred_by_expires_at TIMESTAMP,
    fee_level SMALLINT,
    fee_level_expires_at TIMESTAMP,
    campaign1_flags BOOLEAN[],
    last_login_ts TIMESTAMP,
    last_swap_ts TIMESTAMP,
    UNIQUE (principal_id)
);
