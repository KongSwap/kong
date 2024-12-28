create or replace function get_usd_amount(token_id int, amount float8)
returns float8 as $$
declare 
	ckusdt_price float8;
	icp_price float8;
	icp_ckusdt_price float8;
	usd_amount float8;
	icp_amount float8;
	max_usd_amount float8;
begin
	-- if token is ckUSDT then return the same
	if token_id = 1 then
		return amount;
	end if;

	-- if token/ckUSDT pool exists
	select balance_1 / balance_0 into ckusdt_price
	from pools p 
	where (token_id_0 = token_id and token_id_1 = 1);

	-- if not, use token/ICP
	select balance_1 / balance_0 into icp_price
	from pools p
	where (token_id_0 = token_id and token_id_1 = 2);

	-- and then ICP/ckUSDT pool
	select balance_1 / balance_0 into icp_ckusdt_price
	from pools p
	where (token_id_0 = 2 and token_id_1 = 1);

	max_usd_amount = 0;
	if ckusdt_price is not null then
		usd_amount = nat_to_decimals(token_id, amount, 1) * ckusdt_price;
		max_usd_amount = usd_amount;
	end if;

	if icp_price is not null and icp_ckusdt_price is not null then
		icp_amount = nat_to_decimals(token_id, amount, 2) * icp_price;
		usd_amount = nat_to_decimals(2, icp_amount, 1) * icp_ckusdt_price;
		if usd_amount > max_usd_amount then
			max_usd_amount = usd_amount;
		end if;
	end if;

	if max_usd_amount != 0 then
		return max_usd_amount;
	end if;

	raise notice 'USD price not available';
	return null;
end;
$$
language plpgsql;