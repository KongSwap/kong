CREATE TABLE users (
    user_id INT PRIMARY KEY,
    principal_id TEXT NOT NULL,
    my_referral_code TEXT NOT NULL,
    referred_by INT,
    referred_by_expires_at TIMESTAMP,
    fee_level SMALLINT,
    fee_level_expires_at TIMESTAMP,
    raw_json JSONB NOT NULL,
    UNIQUE (principal_id)
);

INSERT INTO users (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
VALUES (0, 'Anonymous', 'None', NULL, NULL, 0, NULL, '{}');

INSERT INTO users (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
VALUES (1, 'All Users', 'None', NULL, NULL, 0, NULL, '{}');

INSERT INTO users (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
VALUES (2, 'System', 'None', NULL, NULL, 0, NULL, '{}');

INSERT INTO users (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
VALUES (3, 'Claims Timer', 'None', NULL, NULL, 0, NULL, '{}');
