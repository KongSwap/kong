CREATE TYPE claim_status AS ENUM ('Unclaimed', 'Claiming', 'Claimed', 'TooManyAttempts');

CREATE TABLE claims (
    claim_id BIGINT PRIMARY KEY,
    user_id INT REFERENCES users(user_id) NOT NULL,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    status claim_status NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    to_address TEXT,
    attempt_request_id BIGINT[],
    transfer_ids BIGINT[],
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);

-- public.claims definition

-- Drop table

-- DROP TABLE public.claims;

CREATE TABLE public.claims (
	claim_id int8 NOT NULL,
	user_id int4 NOT NULL,
	token_id int4 NOT NULL,
	status public."claim_status" NOT NULL,
	amount float8 NOT NULL,
	request_id int8 NULL,
	to_address text NULL,
	attempt_request_id _int8 NULL,
	transfer_ids _int8 NULL,
	ts timestamp NOT NULL,
	raw_json jsonb NOT NULL,
	"desc" text NULL,
	CONSTRAINT claims_pkey PRIMARY KEY (claim_id),
	CONSTRAINT claims_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT claims_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);