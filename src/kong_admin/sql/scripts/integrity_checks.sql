SELECT generate_series
FROM generate_series(
  (SELECT MIN(request_id) FROM requests),
  (SELECT MAX(request_id) FROM requests)
) AS generate_series
WHERE NOT EXISTS (
  SELECT 1
  FROM requests
  WHERE requests.request_id = generate_series
);

SELECT generate_series
FROM generate_series(
  (SELECT MIN(tx_id) FROM txs),
  (SELECT MAX(tx_id) FROM txs)
) AS generate_series
WHERE NOT EXISTS (
  SELECT 1
  FROM txs
  WHERE txs.tx_id = generate_series
);

SELECT generate_series
FROM generate_series(
  (SELECT MIN(transfer_id) FROM transfers),
  (SELECT MAX(transfer_id) FROM transfers)
) AS generate_series
WHERE NOT EXISTS (
  SELECT 1
  FROM transfers
  WHERE transfers.transfer_id = generate_series
);