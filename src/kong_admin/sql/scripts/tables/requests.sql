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

-- public.requests definition

-- Drop table

-- DROP TABLE public.requests;

CREATE TABLE public.requests (
	request_id int8 NOT NULL,
	user_id int4 NOT NULL,
	"request_type" public."request_type" NOT NULL,
	request jsonb NOT NULL,
	reply jsonb NOT NULL,
	statuses jsonb NULL,
	ts timestamp NOT NULL,
	CONSTRAINT requests_pkey PRIMARY KEY (request_id),
	CONSTRAINT requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE INDEX requests_request_type_idx ON public.requests USING btree (request_type);
CREATE INDEX requests_ts_idx ON public.requests USING btree (ts);
CREATE INDEX requests_user_id_idx ON public.requests USING btree (user_id);