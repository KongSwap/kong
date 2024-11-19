import { json } from '@sveltejs/kit';
import { Pool } from 'pg';

const pool = new Pool({
    user: 'kong',
    host: 'localhost',
    database: 'kong',
    password: 'kong',
    port: 5432,
});

export async function GET({ url }) {
    const days = Number(url.searchParams.get('days')) || 7;
    
    try {
        // Get volume data
        const volumeQuery = `
            SELECT 
                DATE_TRUNC('day', tx.ts) as date,
                SUM(tx.pay_amount * tx.price) as volume
            FROM swap_tx tx
            WHERE tx.ts >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE_TRUNC('day', tx.ts)
            ORDER BY date DESC;
        `;
        
        // Get price history
        const priceQuery = `
            SELECT 
                tx.pay_token_id,
                t.symbol,
                DATE_TRUNC('hour', tx.ts) as date,
                AVG(tx.price) as price
            FROM swap_tx tx
            JOIN tokens t ON tx.pay_token_id = t.token_id
            WHERE tx.ts >= NOW() - INTERVAL '${days} days'
            GROUP BY tx.pay_token_id, t.symbol, DATE_TRUNC('hour', tx.ts)
            ORDER BY date DESC;
        `;

        // Get liquidity data
        const liquidityQuery = `
            SELECT 
                DATE_TRUNC('day', tx.ts) as date,
                SUM(tx.add_lp_token_amount) as liquidity
            FROM add_liquidity_tx tx
            WHERE tx.ts >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE_TRUNC('day', tx.ts)
            ORDER BY date DESC;
        `;

        const [volumeResult, priceResult, liquidityResult] = await Promise.all([
            pool.query(volumeQuery),
            pool.query(priceQuery),
            pool.query(liquidityQuery)
        ]);

        return json({
            volume: volumeResult.rows,
            prices: priceResult.rows,
            liquidity: liquidityResult.rows
        });
    } catch (error) {
        console.error('Database query error:', error);
        return json({ error: 'Failed to fetch historical data' }, { status: 500 });
    }
}
