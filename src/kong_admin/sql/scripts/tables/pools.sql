CREATE TABLE pools (
    pool_id INT PRIMARY KEY,
    token_id_0 INT REFERENCES tokens(token_id) NOT NULL,
    balance_0 DOUBLE PRECISION NOT NULL,
    lp_fee_0 DOUBLE PRECISION NOT NULL,
    kong_fee_0 DOUBLE PRECISION NOT NULL,
    token_id_1 INT REFERENCES tokens(token_id) NOT NULL,
    balance_1 DOUBLE PRECISION NOT NULL,
    lp_fee_1 DOUBLE PRECISION NOT NULL,
    kong_fee_1 DOUBLE PRECISION NOT NULL,
    lp_fee_bps SMALLINT NOT NULL,
    kong_fee_bps SMALLINT NOT NULL,
    lp_token_id INT REFERENCES tokens(token_id) NOT NULL,
    is_removed BOOLEAN NOT NULL,
    tvl DOUBLE PRECISION NOT NULL,
    rolling_24h_volume DOUBLE PRECISION NOT NULL,
    rolling_24h_lp_fee DOUBLE PRECISION NOT NULL,
    rolling_24h_num_swaps INT NOT NULL,
    rolling_24h_apy DOUBLE PRECISION NOT NULL,
    raw_json JSONB NOT NULL
);

-- public.pools definition

-- Drop table

-- DROP TABLE public.pools;

CREATE TABLE public.pools (
	pool_id int4 NOT NULL,
	token_id_0 int4 NOT NULL,
	balance_0 float8 NOT NULL,
	lp_fee_0 float8 NOT NULL,
	kong_fee_0 float8 NOT NULL,
	token_id_1 int4 NOT NULL,
	balance_1 float8 NOT NULL,
	lp_fee_1 float8 NOT NULL,
	kong_fee_1 float8 NOT NULL,
	lp_fee_bps int2 NOT NULL,
	kong_fee_bps int2 NOT NULL,
	lp_token_id int4 NOT NULL,
	rolling_24h_volume float8 NULL,
	rolling_24h_lp_fee float8 NULL,
	rolling_24h_num_swaps int4 NULL,
	rolling_24h_apy float8 NULL,
	raw_json jsonb NOT NULL,
	tvl float8 NULL,
	is_removed bool DEFAULT false NULL,
	CONSTRAINT pools_pkey PRIMARY KEY (pool_id),
	CONSTRAINT pools_lp_token_id_fkey FOREIGN KEY (lp_token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT pools_token_id_0_fkey FOREIGN KEY (token_id_0) REFERENCES public.tokens(token_id),
	CONSTRAINT pools_token_id_1_fkey FOREIGN KEY (token_id_1) REFERENCES public.tokens(token_id)
);
CREATE INDEX idx_pools_valid_liquidity ON public.pools USING btree (token_id_0, token_id_1, balance_0, balance_1) WHERE ((balance_0 > (0)::double precision) AND (balance_1 > (0)::double precision));
CREATE INDEX pools_is_removed_idx ON public.pools USING btree (is_removed);
CREATE INDEX pools_token_id_0_and_1_idx ON public.pools USING btree (token_id_0, token_id_1);