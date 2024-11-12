-- get_symbol
CREATE OR REPLACE FUNCTION get_symbol(v_token_id INT)
RETURNS TEXT AS $$
DECLARE
    v_symbol TEXT;
BEGIN
    SELECT t.symbol INTO v_symbol
    FROM tokens t
    WHERE t.token_id = v_token_id;

    RETURN COALESCE(v_symbol, '');
END;
$$
 LANGUAGE plpgsql;
 
select get_symbol(1) as symbol

-- get_token
CREATE OR REPLACE FUNCTION get_token(v_token_id INT)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_token_type TEXT;
    v_canister_id TEXT;
BEGIN
    SELECT t.token_type, t.canister_id
    INTO v_token_type, v_canister_id
    FROM tokens t
    WHERE t.token_id = v_token_id;

    IF v_token_type = 'IC' THEN
        v_token := CONCAT('IC.', v_canister_id);
    ELSE
        v_token := '';
    END IF;

    RETURN COALESCE(v_token, '');
END;
$$
 LANGUAGE plpgsql;

select get_token(1) as token