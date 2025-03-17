CREATE TABLE transfers (
    transfer_id BIGINT PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    is_send BOOLEAN NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    block_index DOUBLE PRECISION,
    tx_hash TEXT,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);

-- public.transfers definition

-- Drop table

-- DROP TABLE public.transfers;

CREATE TABLE public.transfers (
	transfer_id int8 NOT NULL,
	request_id int8 NOT NULL,
	token_id int4 NOT NULL,
	is_send bool NOT NULL,
	amount float8 NOT NULL,
	block_index float8 NULL,
	tx_hash text NULL,
	ts timestamp NOT NULL,
	raw_json jsonb NOT NULL,
	CONSTRAINT transfers_pkey PRIMARY KEY (transfer_id),
	CONSTRAINT transfers_requests_fk FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT transfers_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.tokens(token_id)
);
CREATE INDEX transfers_token_id_idx ON public.transfers USING btree (token_id, request_id);