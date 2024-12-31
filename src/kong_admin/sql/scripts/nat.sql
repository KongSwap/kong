-- convert from nat to real amount
create or replace function nat_to_real(token_id int, amount float8)
returns float8 as $$
declare
	token_decimals smallint;
begin
	select decimals into token_decimals
	from tokens t
	where token_id = token_id;
	return amount / power(10, token_decimals);
end;
$$
language plpgsql;

-- convert from one token's decimal precision to another
create or replace function nat_to_decimals(from_token_id int, from_amount float8, to_token_id int)
returns float8 as $$
declare
	from_token_decimals smallint;
	to_token_decimals smallint;
	diff_decimals smallint;
begin
	select decimals into from_token_decimals
	from tokens t
	where token_id = from_token_id;

	select decimals into to_token_decimals
	from tokens t
	where token_id = to_token_id;

	if from_token_decimals = to_token_decimals then
		return from_amount;
	elsif to_token_decimals < from_token_decimals then
		diff_decimals = from_token_decimals - to_token_decimals;
		return from_amount / power(10, diff_decimals);
	else
		diff_decimals = to_token_decimals - from_token_decimals;
		return from_amount * power(10, diff_decimals);
	end if;
end;
$$
language plpgsql;
