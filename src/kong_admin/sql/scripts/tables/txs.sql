CREATE TYPE tx_type AS ENUM ('add_pool', 'add_liquidity', 'remove_liquidity', 'swap', 'send');

CREATE TYPE tx_status AS ENUM ('Success', 'Failed');

CREATE TABLE txs (
    tx_id BIGINT PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    tx_type tx_type NOT NULL,
    status tx_status NOT NULL,
    ts TIMESTAMP NOT NULL,
    raw_json JSONB NOT NULL
);

CREATE TABLE add_pool_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    is_removed BOOLEAN NOT NULL,
    ts TIMESTAMP NOT NULL
);

CREATE TABLE add_liquidity_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    add_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE remove_liquidity_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount_0 DOUBLE PRECISION NOT NULL,
    lp_fee_0 DOUBLE PRECISION NOT NULL,
    amount_1 DOUBLE PRECISION NOT NULL,
    lp_fee_1 DOUBLE PRECISION NOT NULL,
    remove_lp_token_amount DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE swap_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    pay_token_id INT REFERENCES tokens(token_id) NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT REFERENCES tokens(token_id) NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    mid_price DOUBLE PRECISION NOT NULL,
    slippage DOUBLE PRECISION NOT NULL,
    transfer_ids BIGINT[],
    claim_ids BIGINT[],
    ts TIMESTAMP NOT NULL
);

CREATE TABLE swap_pool_tx (
    tx_id BIGINT REFERENCES txs(tx_id) NOT NULL,
    pool_id INT REFERENCES pools(pool_id) NOT NULL,
    pay_token_id INT REFERENCES tokens(token_id) NOT NULL,
    pay_amount DOUBLE PRECISION NOT NULL,
    receive_token_id INT REFERENCES tokens(token_id) NOT NULL,
    receive_amount DOUBLE PRECISION NOT NULL,
    lp_fee DOUBLE PRECISION NOT NULL,
    gas_fee DOUBLE PRECISION NOT NULL,
    ts TIMESTAMP NOT NULL
);

CREATE TABLE send_tx (
    tx_id BIGINT REFERENCES txs(tx_id) PRIMARY KEY,
    token_id INT REFERENCES tokens(token_id) NOT NULL,
    request_id BIGINT REFERENCES requests(request_id) NOT NULL,
    user_id INT REFERENCES users(user_id) NOT NULL,
    status tx_status NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    to_user_id INT REFERENCES users(user_id) NOT NULL,
    ts TIMESTAMP NOT NULL
);

-- public.txs definition

-- Drop table

-- DROP TABLE public.txs;

CREATE TABLE public.txs (
	tx_id int8 NOT NULL,
	request_id int8 NOT NULL,
	user_id int4 NOT NULL,
	"tx_type" public."tx_type" NOT NULL,
	status public."tx_status" NOT NULL,
	ts timestamp NOT NULL,
	raw_json jsonb NOT NULL,
	CONSTRAINT txs_pkey PRIMARY KEY (tx_id),
	CONSTRAINT txs_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT txs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE INDEX idx_txs_ts_casted ON public.txs USING btree (ts);
CREATE INDEX idx_txs_user_id ON public.txs USING btree (user_id);
CREATE INDEX txs_status_idx ON public.txs USING btree (status);
CREATE INDEX txs_tx_type_idx ON public.txs USING btree (tx_type);

-- public.add_liquidity_tx definition

-- Drop table

-- DROP TABLE public.add_liquidity_tx;

CREATE TABLE public.add_liquidity_tx (
	tx_id int8 NOT NULL,
	pool_id int4 NOT NULL,
	request_id int8 NOT NULL,
	user_id int4 NOT NULL,
	status public."tx_status" NOT NULL,
	amount_0 float8 NOT NULL,
	amount_1 float8 NOT NULL,
	add_lp_token_amount float8 NOT NULL,
	transfer_ids _int8 NULL,
	claim_ids _int8 NULL,
	ts timestamp NOT NULL,
	id bigserial NOT NULL,
	CONSTRAINT add_liquidity_tx_pk PRIMARY KEY (tx_id),
	CONSTRAINT add_liquidity_tx_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(pool_id),
	CONSTRAINT add_liquidity_tx_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT add_liquidity_tx_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.txs(tx_id),
	CONSTRAINT add_liquidity_tx_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE UNIQUE INDEX add_liquidity_tx_id_idx ON public.add_liquidity_tx USING btree (id);
CREATE INDEX add_liquidity_tx_pool_id_idx ON public.add_liquidity_tx USING btree (pool_id);
CREATE INDEX add_liquidity_tx_tx_id_idx ON public.add_liquidity_tx USING btree (tx_id);
CREATE INDEX add_liquidity_tx_user_id_idx ON public.add_liquidity_tx USING btree (user_id, pool_id);

-- public.add_pool_tx definition

-- Drop table

-- DROP TABLE public.add_pool_tx;

CREATE TABLE public.add_pool_tx (
	tx_id int8 NOT NULL,
	pool_id int4 NOT NULL,
	request_id int8 NOT NULL,
	user_id int4 NOT NULL,
	status public."tx_status" NOT NULL,
	amount_0 float8 NOT NULL,
	amount_1 float8 NOT NULL,
	add_lp_token_amount float8 NOT NULL,
	transfer_ids _int8 NULL,
	claim_ids _int8 NULL,
	ts timestamp NOT NULL,
	is_removed bool DEFAULT false NULL,
	CONSTRAINT add_pool_tx_pkey PRIMARY KEY (tx_id),
	CONSTRAINT add_pool_tx_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(pool_id),
	CONSTRAINT add_pool_tx_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT add_pool_tx_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.txs(tx_id),
	CONSTRAINT add_pool_tx_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- public.remove_liquidity_tx definition

-- Drop table

-- DROP TABLE public.remove_liquidity_tx;

CREATE TABLE public.remove_liquidity_tx (
	tx_id int8 NOT NULL,
	pool_id int4 NOT NULL,
	request_id int8 NOT NULL,
	user_id int4 NOT NULL,
	status public."tx_status" NOT NULL,
	amount_0 float8 NOT NULL,
	lp_fee_0 float8 NOT NULL,
	amount_1 float8 NOT NULL,
	lp_fee_1 float8 NOT NULL,
	remove_lp_token_amount float8 NOT NULL,
	transfer_ids _int8 NULL,
	claim_ids _int8 NULL,
	ts timestamp NOT NULL,
	CONSTRAINT remove_liquidity_tx_pkey PRIMARY KEY (tx_id),
	CONSTRAINT remove_liquidity_tx_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(pool_id),
	CONSTRAINT remove_liquidity_tx_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT remove_liquidity_tx_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.txs(tx_id),
	CONSTRAINT remove_liquidity_tx_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- public.send_tx definition

-- Drop table

-- DROP TABLE public.send_tx;

CREATE TABLE public.send_tx (
	tx_id int8 NOT NULL,
	token_id int4 NOT NULL,
	request_id int8 NOT NULL,
	user_id int4 NOT NULL,
	status public."tx_status" NOT NULL,
	amount float8 NOT NULL,
	to_user_id int4 NOT NULL,
	ts timestamp NOT NULL,
	CONSTRAINT send_tx_pkey PRIMARY KEY (tx_id),
	CONSTRAINT send_tx_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT send_tx_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(user_id),
	CONSTRAINT send_tx_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT send_tx_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.txs(tx_id),
	CONSTRAINT send_tx_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE INDEX send_tx_to_user_id_idx ON public.send_tx USING btree (to_user_id);
CREATE INDEX send_tx_token_id_idx ON public.send_tx USING btree (token_id);
CREATE INDEX send_tx_user_id_idx ON public.send_tx USING btree (user_id);

-- public.swap_pool_tx definition

-- Drop table

-- DROP TABLE public.swap_pool_tx;

CREATE TABLE public.swap_pool_tx (
	tx_id int8 NOT NULL,
	pool_id int4 NOT NULL,
	pay_token_id int4 NOT NULL,
	pay_amount float8 NOT NULL,
	receive_token_id int4 NOT NULL,
	receive_amount float8 NOT NULL,
	lp_fee float8 NOT NULL,
	gas_fee float8 NOT NULL,
	ts timestamp NOT NULL,
	id bigserial NOT NULL,
	CONSTRAINT swap_pool_tx_pkey PRIMARY KEY (id),
	CONSTRAINT swap_pool_tx_pay_token_id_fkey FOREIGN KEY (pay_token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT swap_pool_tx_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.pools(pool_id),
	CONSTRAINT swap_pool_tx_receive_token_id_fkey FOREIGN KEY (receive_token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT swap_pool_tx_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.txs(tx_id)
);
CREATE INDEX idx_swap_pool_tx_token_pair ON public.swap_pool_tx USING btree (pay_token_id, receive_token_id, ts);
CREATE INDEX idx_swap_pool_tx_ts_casted ON public.swap_pool_tx USING btree (ts);
CREATE INDEX idx_swap_pool_tx_tx_id ON public.swap_pool_tx USING btree (tx_id);
CREATE INDEX swap_pool_tx_pool_id_idx ON public.swap_pool_tx USING btree (pool_id);
CREATE INDEX swap_pool_tx_receive_token_id_idx ON public.swap_pool_tx USING btree (receive_token_id, pay_token_id, ts);

-- public.swap_tx definition

-- Drop table

-- DROP TABLE public.swap_tx;

CREATE TABLE public.swap_tx (
	tx_id int8 NOT NULL,
	request_id int8 NOT NULL,
	user_id int4 NOT NULL,
	status public."tx_status" NOT NULL,
	pay_token_id int4 NOT NULL,
	pay_amount float8 NOT NULL,
	receive_token_id int4 NOT NULL,
	receive_amount float8 NOT NULL,
	price float8 NOT NULL,
	mid_price float8 NOT NULL,
	slippage float8 NOT NULL,
	transfer_ids _int8 NULL,
	claim_ids _int8 NULL,
	ts timestamp NOT NULL,
	CONSTRAINT swap_tx_pkey PRIMARY KEY (tx_id),
	CONSTRAINT swap_tx_pay_token_id_fkey FOREIGN KEY (pay_token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT swap_tx_receive_token_id_fkey FOREIGN KEY (receive_token_id) REFERENCES public.tokens(token_id),
	CONSTRAINT swap_tx_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(request_id),
	CONSTRAINT swap_tx_tx_id_fkey FOREIGN KEY (tx_id) REFERENCES public.txs(tx_id),
	CONSTRAINT swap_tx_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE INDEX idx_swap_tx_tokens ON public.swap_tx USING btree (pay_token_id, receive_token_id);
CREATE INDEX idx_swap_tx_tokens_ts ON public.swap_tx USING btree (pay_token_id, receive_token_id, ts DESC) WHERE ((status = 'Success'::tx_status) AND (pay_amount > (0)::double precision) AND (receive_amount > (0)::double precision));
