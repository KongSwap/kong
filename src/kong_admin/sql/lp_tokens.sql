SELECT
    t.symbol,
    ltl.amount,
    TO_CHAR(
        (ltl.amount / SUM(ltl.amount) OVER (PARTITION BY t.symbol)) * 100, 
        'FM990D00%'
    ) AS "pct_of_pool",
    u.principal_id
FROM lp_token_ledger ltl
JOIN tokens t ON ltl.token_id = t.token_id 
JOIN users u ON ltl.user_id = u.user_id
WHERE ltl.amount > 0
ORDER BY t.symbol, ltl.amount desc