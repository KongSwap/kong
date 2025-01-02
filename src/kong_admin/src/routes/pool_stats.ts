import { Router } from 'express';
import { db } from '../db';

const router = Router();

// Get 24-hour stats for all pools
router.get('/api/pool-stats', async (req, res) => {
  try {
    const stats = await db.query(`
      WITH pool_stats AS (
        SELECT 
          spt.pool_id,
          COUNT(DISTINCT spt.tx_id) as num_swaps,
          SUM(CASE 
            WHEN spt.pay_token_id = p.token_id_0 THEN spt.pay_amount
            ELSE spt.receive_amount
          END) as volume_in_token0,
          SUM(spt.lp_fee) as lp_fee,
          p.tvl
        FROM swap_pool_tx spt
        JOIN txs t ON t.tx_id = spt.tx_id
        JOIN pools p ON p.pool_id = spt.pool_id
        WHERE t.ts >= NOW() - INTERVAL '24 hours'
          AND t.status = 'Success'
        GROUP BY spt.pool_id, p.tvl
      )
      SELECT 
        pool_id,
        num_swaps,
        volume_in_token0 as volume_24h,
        lp_fee as lp_fee_24h,
        CASE 
          WHEN tvl > 0 THEN (lp_fee / tvl * 365 * 100)
          ELSE 0
        END as apy_24h
      FROM pool_stats
    `);
    
    res.json(stats.rows);
  } catch (error) {
    console.error('Error fetching pool stats:', error);
    res.status(500).json({ error: 'Failed to fetch pool stats' });
  }
});

export default router;
