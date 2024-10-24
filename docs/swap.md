Swap (swap.rs, swap_calc.rs)
----

For users to execute swaps against the pool, they need to call swap().

Pricing is based on the CPF,

(amount_0 + balance_0) * (amount_1 + balance_1) = balance_0 * balance_1

therfore, if pay token is token_0, you can determine the amount_1, the receive token_1

amount_1 = (amount_0 * balance_1) / (balance_0 + amount_0)

or if pay token is token_1, you can determine the amount_0, the receive token_0

amount_0 = (amount_1 * balance_0) / (balance_1 + amount_1)

Therefore,

Swap Price = receive_amount / pay_amount

The remaining pool balances will decrease by receive_amount (receive is from the swap user's point of view) and increase by pay_amount
The new balance_0 and balance_1 of the pool will set the new pool price.



