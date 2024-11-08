CREATE OR REPLACE VIEW public.pools_with_token_symbols
AS SELECT p.pool_id,
    t0.symbol AS symbol_0,
    t1.symbol AS symbol_1,
    p.balance_0,
    p.lp_fee_0,
    p.kong_fee_0,
    p.balance_1,
    p.lp_fee_1,
    p.kong_fee_1,
    p.lp_fee_bps,
    p.kong_fee_bps,
    p.on_kong
   FROM pools p
     JOIN tokens t0 ON p.token_id_0 = t0.token_id
     JOIN tokens t1 ON p.token_id_1 = t1.token_id
  ORDER BY p.pool_id;