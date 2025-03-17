CREATE TABLE lp_tokens (
    lp_token_id BIGINT PRIMARY KEY,
    user_id INT REFERENCES users(user_id) NOT NULL,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL,
    UNIQUE (user_id, token_id)
);

-- public.lp_tokens definition

-- Drop table

-- DROP TABLE public.lp_tokens;

CREATE TABLE public.lp_tokens (
	lp_token_id int8 NOT NULL,
	user_id int4 NULL,
	token_id int4 NULL,
	amount float8 NOT NULL,
	ts timestamp NOT NULL,
	raw_json jsonb NOT NULL,
	CONSTRAINT lp_token_ledger_pkey PRIMARY KEY (lp_token_id),
	CONSTRAINT lp_token_ledger_user_id_token_id_key UNIQUE (user_id, token_id),
	CONSTRAINT lp_token_ledger_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT lp_token_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);