Add Liquidity (add_liquidity.rs)
-------------

Add liquidity is the process where the user deposits two tokens into a pool and in return gets LP tokens to represent his share of the pool. His two tokens in the pools are then used by users to execute swaps againsts the pool and thereby earn trading fees.

kong_backend is responsible for managing all the pools. Each pool consists of two tokens, for example, ICP (token_0) and ckUSDC (token_1) where all trading between ICP and ckUSDC is managed by that pool (ICP_ckUSDC pool). The pool has an inventory of ICP (balance_0) and ckUSDC (balance_1) which is deposited by LP providers through add_liquidity. The pool also manages the LP token of the pool, called ICP_ckUSDC_LP which is itself an ICRC2 ledger canister which represents the LP providers share of the pool.

Initially, a pool starts with zero balance_0, balance_1, and lp_token. The first LP provider, deposits amount_0 of token_0 and amount_1 of token_1 which then sets the price for the pool. For example, if the user deposits 10 ICP and 100 ckUSDC, then amount_0=10 and amount_1=100, making balance_0=10 and balance_1=100 as this is the initial deposit. The swap price is set as balance_1 / balance_0 = 10, meaning for 1 ICP you will receive 10 ckUSDC. Pricing is based on the Constant Product Formula (CPF), balance_0 * balance_1 = K, where K is set initially and remains constant. In our example, K is set at K = 10 * 100 = 1,000 as that was the first deposit.

In return for providing amount_0 and amount_1, the user gets lp_token to represent his share of the pool. The initial lp_token is set using lp_token(initial) = SQRT(amount_0 * amount_1). In our example SQRT(10 * 100) = 31.6227766, so the user will receive 31.6227766 lp_token (ICP_ckUSDC_LP) with the total_supply_lp_token also being the same amount representing he currently owns 100% of the pool. 

As other users add liquidity, they must maintain the ratio of the pool, ie. to keep the K constant. You can expand CPF to (balance_0 + amount_0) * (balance_1 + amount_1) = K, to handle the case where amount_0 and amount_1 are the deposit amounts a user must deposit. By re-arranging the formula and keeping K constant, you can determine:

amount_0 * balance_1 = amount_1 * balance_0   <-- equalibrum formula where constant K is maintained

amount_0 = amount_1 * balance_0 / balance_1
amount_1 = amount_0 * balance_1 / balance_0

This means for a new LP provider to add liquidity to the pool, he must deposit amount_0 of token_0 and amount_1 of token_1. The api add_liquidity_amounts() is used to calculate this for the user. Therefore, this maintains the constant K, and as users add liquidity, the price of the pool is not affected as the ratio of balance_0 and balance_1 remains the same.

New LP providers will also receive lp_token for their deposits. Therefore, new lp_token need to be minted to ensure existing LP providers have the same rewards but lower share of the pool. ie. as new LP provoiders come in, their rewards remains the same, but the total_supply_lp_token increases so they have a lower share of the pool. The amount of new lp_token to mint is according to the formula:

new LP tokens to mint: Min [ total_supply_lp_token * amount_0 / balance_0, total_supply_lp_token * amount_1 / balance_1 ]

Therefore, new LP tokens are minted based on the proportion to the pool's token inventory. This increases the total_supply_lp_token. 
Existings users maintain their current lp_token amount, but their percentage of the pool share decreases. The new LP provider receives the minted lp_token and also has a percentage of the pool.
