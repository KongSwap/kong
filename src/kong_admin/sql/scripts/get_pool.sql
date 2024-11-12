CREATE OR REPLACE FUNCTION get_pool(v_pool_id INT)
RETURNS TEXT AS $$
DECLARE
    v_pool TEXT;
BEGIN
    SELECT CONCAT(t0.symbol, '/', t1.symbol) INTO v_pool
    FROM pools p 
    JOIN tokens t0 ON p.token_id_0 = t0.token_id
    JOIN tokens t1 ON p.token_id_1 = t1.token_id
    WHERE p.pool_id = v_pool_id;

    RETURN COALESCE(v_pool, '');
END;
$$
 LANGUAGE plpgsql;
 
select get_pool(1) as pool;