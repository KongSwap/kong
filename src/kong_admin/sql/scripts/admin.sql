CREATE OR REPLACE FUNCTION get_missing_tx_ids()
RETURNS TABLE (missing_tx_id bigint) AS $$
BEGIN
    RETURN QUERY
    WITH sequence AS (
        SELECT generate_series(
            (SELECT MIN(tx_id) FROM public.txs),
            (SELECT MAX(tx_id) FROM public.txs)
        ) AS expected_tx_id
    )
    SELECT sequence.expected_tx_id
    FROM sequence
    LEFT JOIN public.txs ON sequence.expected_tx_id = txs.tx_id
    WHERE txs.tx_id IS NULL
    ORDER BY sequence.expected_tx_id;
END;
$$
 LANGUAGE plpgsql;

select get_missing_tx_ids();

CREATE OR REPLACE FUNCTION get_missing_request_ids()
RETURNS TABLE (missing_request_id bigint) AS $$
BEGIN
    RETURN QUERY
    WITH sequence AS (
        SELECT generate_series(
            (SELECT MIN(request_id) FROM public.requests),
            (SELECT MAX(request_id) FROM public.requests)
        ) AS expected_request_id
    )
    SELECT sequence.expected_request_id
    FROM sequence
    LEFT JOIN public.requests ON sequence.expected_request_id = requests.request_id
    WHERE requests.request_id IS NULL
    ORDER BY sequence.expected_request_id;
END;
$$
 LANGUAGE plpgsql;

select get_missing_request_ids();

CREATE OR REPLACE FUNCTION get_missing_transfer_ids()
RETURNS TABLE (missing_transfer_id bigint) AS $$
BEGIN
    RETURN QUERY
    WITH sequence AS (
        SELECT generate_series(
            (SELECT MIN(transfer_id) FROM public.transfers),
            (SELECT MAX(transfer_id) FROM public.transfers)
        ) AS expected_transfer_id
    )
    SELECT sequence.expected_transfer_id
    FROM sequence
    LEFT JOIN public.transfers ON sequence.expected_transfer_id = transfers.transfer_id
    WHERE transfers.transfer_id IS NULL
    ORDER BY sequence.expected_transfer_id;
END;
$$
 LANGUAGE plpgsql;

select get_missing_transfer_ids();

CREATE OR REPLACE FUNCTION get_missing_lp_token_ids()
RETURNS TABLE (missing_lp_token_id bigint) AS $$
BEGIN
    RETURN QUERY
    WITH sequence AS (
        SELECT generate_series(
            (SELECT MIN(lp_token_id) FROM public.lp_tokens),
            (SELECT MAX(lp_token_id) FROM public.lp_tokens)
        ) AS expected_lp_token_id
    )
    SELECT sequence.expected_lp_token_id
    FROM sequence
    LEFT JOIN public.lp_tokens ON sequence.expected_lp_token_id = lp_tokens.lp_token_id
    WHERE lp_tokens.lp_token_id IS NULL
    ORDER BY sequence.expected_lp_token_id;
END;
$$
 LANGUAGE plpgsql;

select get_missing_lp_token_ids();