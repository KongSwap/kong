import { formatToNonZeroDecimal } from '$lib/utils/numberFormatUtils';
import { userTokens } from '$lib/stores/userTokens';
import { get } from 'svelte/store';
import BigNumber from 'bignumber.js';

export function getPriceChangeClass(token: Kong.Token): string {
  if (!token?.metrics?.price_change_24h) return '';
  const change = Number(token?.metrics?.price_change_24h);
  if (change > 0) return 'text-kong-success';
  if (change < 0) return 'text-kong-error';
  return '';
}

export async function formatPoolData(pools: BE.Pool[]): Promise<BE.Pool[]> {
  if (pools.length === 0) return pools;
  const poolsMap = await Promise.all(pools.map(async (pool, index) => {
    const apy = formatToNonZeroDecimal(pool.rolling_24h_apy);
    const userTokensStore = get(userTokens);
    const baseToken = userTokensStore.tokens.find(t => t.address === pool.address_1);
    return {
      ...pool,
      price_usd: (Number(pool.price) * Number(baseToken?.metrics.price)).toString(),
      id: `${pool.symbol_0}-${pool.symbol_1}-${index}`,
      apy,
    };
  }));
  return poolsMap;
}

export function getPoolPriceUsd(pool: BE.Pool): number {
  if (!pool || !pool.balance_0 || !pool.balance_1) return 0;
  
  try {
    let balance0 = new BigNumber(pool.balance_0.toString());
    let balance1 = new BigNumber(pool.balance_1.toString());
    let lpFee0 = new BigNumber((pool.lp_fee_0 || 0).toString());
    let lpFee1 = new BigNumber((pool.lp_fee_1 || 0).toString());
    
    // Avoid division by zero
    const denominator = balance0.plus(lpFee0);
    if (denominator.isZero()) return 0;
    
    let poolPrice = new BigNumber((balance1.plus(lpFee1)).div(denominator));
    return poolPrice.toNumber();
  } catch (error) {
    console.warn('Error calculating pool price:', error);
    return 0;
  }
}

/**
 * Calculate price precision and movement values based on price
 */
export function calculatePricePrecision(price: number, quoteDecimals: number, baseDecimals: number) {
  const adjustedPrice = price * Math.pow(10, baseDecimals - quoteDecimals);
  
  // Determine precision and minMove based on price
  const precision = adjustedPrice >= 1000 ? 6 : 8;
  const minMove = adjustedPrice >= 1000 ? 0.000001 : 0.00000001;
  
  return { precision, minMove };
}

/**
 * Updates TradingView widget price scale precision
 */
export function updateTradingViewPriceScale(widget: any, pool: BE.Pool) {
  if (!widget?.chart || !widget.chart() || !pool?.price) return;
  
  try {
    const { precision, minMove } = calculatePricePrecision(
      pool.price, 
      pool.token0.decimals, 
      pool.token1.decimals
    );
    
    widget.applyOverrides({
      "mainSeriesProperties.priceFormat.precision": precision,
      "mainSeriesProperties.priceFormat.minMove": minMove
    });
    
    // Force chart to redraw
    setTimeout(() => {
      try {
        widget.chart().executeActionById("chartReset");
      } catch (e) {
        console.warn("[Chart] Error resetting chart:", e);
      }
    }, 100);
  } catch (e) {
    console.warn("[Chart] Error updating price scale:", e);
  }
}

/**
 * Find the best pool for a given token pair
 */
export function findBestPoolForTokens(
  quoteToken: Kong.Token | undefined, 
  baseToken: Kong.Token | undefined, 
  pools: BE.Pool[], 
  currentPoolId?: number
): { pool_id: number } | null {
  if (!quoteToken || !baseToken) {
    return currentPoolId ? { pool_id: currentPoolId } : null;
  }

  try {
    const qId = quoteToken.address;
    const bId = baseToken.address;
    
    // First look for direct pool
    const directPool = pools.find(p => 
      (p.address_0 === qId && p.address_1 === bId) || 
      (p.address_1 === qId && p.address_0 === bId)
    );
    
    if (directPool) {
      return { pool_id: Number(directPool.pool_id) };
    }

    // Then try related pool
    const relatedPool = pools.find(p => 
      [p.address_0, p.address_1].some(addr => addr === qId || addr === bId)
    );

    if (relatedPool) {
      return { pool_id: Number(relatedPool.pool_id) };
    }

    return null;
  } catch (error) {
    console.error("[Chart] Failed to get pool info:", error);
    return null;
  }
}
