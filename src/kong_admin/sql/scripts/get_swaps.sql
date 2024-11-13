CREATE OR REPLACE FUNCTION get_swaps(token_0 TEXT, token_1 TEXT)
RETURNS TABLE (
    direction TEXT,
    pay_symbol TEXT,
    pay_amount DOUBLE PRECISION,
    receive_symbol TEXT,
    receive_amount DOUBLE PRECISION,
    price DOUBLE PRECISION,
    ts TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
      CASE WHEN t0.symbol = token_0 THEN 'sell' ELSE 'buy' END AS direction,
      CASE WHEN t0.symbol = token_0 THEN t0.symbol ELSE t1.symbol END AS pay_symbol,
      CASE WHEN t0.symbol = token_0 THEN txs.pay_amount ELSE txs.receive_amount END AS pay_amount,
      CASE WHEN t0.symbol = token_0 THEN t1.symbol ELSE t0.symbol END AS receive_symbol,
      CASE WHEN t0.symbol = token_0 THEN txs.receive_amount ELSE txs.pay_amount END AS receive_amount,
      CASE WHEN t0.symbol = token_0 THEN txs.receive_amount / txs.pay_amount ELSE txs.pay_amount / txs.receive_amount END AS price,
      tx.ts AS ts
  FROM swap_pool_tx txs
  JOIN tokens t0 ON txs.pay_token_id = t0.token_id
  JOIN tokens t1 ON txs.receive_token_id = t1.token_id
  JOIN swap_tx tx ON txs.tx_id = tx.tx_id
  WHERE (t0.symbol = token_0 AND t1.symbol = token_1) OR (t0.symbol = token_1 AND t1.symbol = token_0);
END;
$$ LANGUAGE plpgsql;

drop function get_swaps;

select * from get_swaps('ICP', 'ckUSDT')
order by ts desc;

-- OHLC (hourly)
WITH hourly_data AS (
  SELECT 
    date_trunc('hour', ts) AS hour,
    price,
    receive_amount as volume,
    ts
  FROM get_swaps('ICP', 'ckUSDT')
),
hourly_ohlc AS (
  SELECT
    hour,
    FIRST_VALUE(price) OVER (PARTITION BY hour ORDER BY ts) AS open,
    MAX(price) OVER (PARTITION BY hour) AS high,
    MIN(price) OVER (PARTITION BY hour) AS low,
    LAST_VALUE(price) OVER (PARTITION BY hour ORDER BY ts
      RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS close,
    SUM(volume) over (PARTITION BY hour) AS volume,
    COUNT(*) OVER (PARTITION BY hour) AS num_swaps
  FROM hourly_data
),
distinct_hourly_ohlc AS (
  SELECT DISTINCT ON (hour)
    hour,
    open,
    high,
    low,
    close,
    volume,
    num_swaps
  FROM hourly_ohlc
)
SELECT 
  hour,
  open,
  high,
  low,
  close,
  volume,
  num_swaps
FROM distinct_hourly_ohlc
ORDER BY hour desc;

-- OHLC (4hourly)
WITH four_hourly_data AS (
  SELECT 
    date_trunc('hour', ts) - (EXTRACT(HOUR FROM ts)::integer % 4) * INTERVAL '1 hour' AS four_hour_bucket,
    price,
    receive_amount as volume,
    ts
  FROM get_swaps('ICP', 'ckUSDT')
),
four_hourly_ohlc AS (
  SELECT
    four_hour_bucket,
    FIRST_VALUE(price) OVER (PARTITION BY four_hour_bucket ORDER BY ts) AS open,
    MAX(price) OVER (PARTITION BY four_hour_bucket) AS high,
    MIN(price) OVER (PARTITION BY four_hour_bucket) AS low,
    LAST_VALUE(price) OVER (PARTITION BY four_hour_bucket ORDER BY ts
      RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS close,
    SUM(volume) OVER (PARTITION BY four_hour_bucket) AS volume,
    COUNT(*) OVER (PARTITION BY four_hour_bucket) AS num_swaps
  FROM four_hourly_data
),
distinct_four_hourly_ohlc AS (
  SELECT DISTINCT ON (four_hour_bucket)
    four_hour_bucket,
    open,
    high,
    low,
    close,
    volume,
    num_swaps
  FROM four_hourly_ohlc
)
SELECT 
  four_hour_bucket,
  open,
  high,
  low,
  close,
  volume,
  num_swaps
FROM distinct_four_hourly_ohlc
ORDER BY four_hour_bucket DESC;

-- OHLC (daily)
WITH daily_data AS (
  SELECT 
    date_trunc('day', ts) AS day,
    price,
    receive_amount as volume,
    ts
  FROM get_swaps('ICP', 'ckUSDT')
),
daily_ohlc AS (
  SELECT
    day,
    FIRST_VALUE(price) OVER (PARTITION BY day ORDER BY ts) AS open,
    MAX(price) OVER (PARTITION BY day) AS high,
    MIN(price) OVER (PARTITION BY day) AS low,
    LAST_VALUE(price) OVER (PARTITION BY day ORDER BY ts
      RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS close,
    SUM(volume) OVER (PARTITION BY day) AS volume,
    COUNT(*) OVER (PARTITION BY day) AS num_swaps
  FROM daily_data
),
distinct_daily_ohlc AS (
  SELECT DISTINCT ON (day)
    day,
    open,
    high,
    low,
    close,
    volume,
    num_swaps
  FROM daily_ohlc
)
SELECT 
  day,
  open,
  high,
  low,
  close,
  volume,
  num_swaps
FROM distinct_daily_ohlc
ORDER BY day DESC;