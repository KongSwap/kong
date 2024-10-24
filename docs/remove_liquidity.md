Remove Liquidity (remove_liquidity.rs)
----------------

Remove liquidity is the reverse process of add liquidity - where the LP provider returns his lp_token and receives back an amount of token_0 and token_1 plus and trading fees, lp_fee_0 and lp_fee_1 collected. Again, to maintain a constant K in the CPF formula, the ratio of token_0 and token_1 is calculated.

amount_0 = balance_0 * lp_token / total_supply_lp_token
amount_1 = balance_1 * lp_token / total_supply_lp_token

this is simply, lp_token / total_supply_lp_token is the LP provider's share of the pool and just multipled by the balance the token in the pool.

Therefore, lp_token is burned as the user returns this and the total_supply_lp_token reduces. So the remaining LP providers share will increase as the user removes liquidity. Also, amount_0 of token_0 and amount_1 of token_1 is then returned back to the LP provider according to the formula above.
