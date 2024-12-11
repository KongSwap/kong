import { kongDB } from "$lib/services/db";
import { fetchChartData } from "$lib/services/indexer/api";
import { poolStore } from "$lib/services/pools";
import { get } from "svelte/store";
import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID, WTN_CANISTER_ID, INDEXER_URL } from "$lib/constants/canisterConstants";
import { writable } from 'svelte/store';

// Store for price updates
export const priceStore = writable<{[key: string]: number}>({});

// Cache for in-flight requests
const requestCache = new Map<string, Promise<any>>();
const tokenLocks = new Map<string, Promise<void>>();

async function acquireTokenLock(tokenId: string): Promise<void> {
  while (tokenLocks.has(tokenId)) {
    await tokenLocks.get(tokenId);
  }
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  tokenLocks.set(tokenId, lockPromise);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
      releaseLock!();
      tokenLocks.delete(tokenId);
    }, 0);
  });
}

async function fetchCandleData(payTokenId: number, receiveTokenId: number, startTime: number, endTime: number): Promise<any> {
  const cacheKey = `${payTokenId}-${receiveTokenId}-${startTime}-${endTime}`;
  
  // Wait for any existing requests for this data to complete
  if (requestCache.has(cacheKey)) {
    return requestCache.get(cacheKey);
  }

  // Get token info for logging
  const tokens = await kongDB.tokens.toArray();
  const payToken = tokens.find(t => Number(t.token_id) === payTokenId);
  const receiveToken = tokens.find(t => Number(t.token_id) === receiveTokenId);
  
  // Log URL if WTN is involved
  if (payToken?.canister_id === WTN_CANISTER_ID || receiveToken?.canister_id === WTN_CANISTER_ID) {
    console.log(`[WTN] Fetching candle data:`, {
      payToken: payToken?.symbol,
      receiveToken: receiveToken?.symbol,
      startTime: new Date(startTime * 1000).toISOString(),
      endTime: new Date(endTime * 1000).toISOString(),
      url: `${INDEXER_URL}/api/swaps/ohlc?pay_token_id=${payTokenId}&receive_token_id=${receiveTokenId}&start_time=${new Date(startTime * 1000).toISOString()}&end_time=${new Date(endTime * 1000).toISOString()}&interval=1d`
    });
  }
  
  const promise = fetchChartData(payTokenId, receiveTokenId, startTime, endTime, "1D")
    .finally(() => {
      // Only clear cache if this is still the active promise
      if (requestCache.get(cacheKey) === promise) {
        requestCache.delete(cacheKey);
      }
    });
  
  requestCache.set(cacheKey, promise);
  return promise;
}

export async function calculate24hPriceChange(token: FE.Token): Promise<number | string> {
  // Acquire lock for this token to prevent parallel calculations
  await acquireTokenLock(token.canister_id);
  
  try {
    // Get current time in UTC
    const now = Math.floor(Date.now() / 1000); // Unix timestamp is already UTC
    const yesterday = now - (24 * 60 * 60);
    // Expand search window to ±24 hours to find more data points
    const searchWindowStart = yesterday - (24 * 60 * 60);
    const searchWindowEnd = yesterday + (24 * 60 * 60);
    const tokenId = Number(token.token_id);

    // console.log(`[${token.symbol}] Getting historical price for token_id ${tokenId}:`, {
    //   targetTime: new Date(yesterday * 1000).toISOString(), // toISOString() returns UTC
    //   searchWindow: {
    //     start: new Date(searchWindowStart * 1000).toISOString(),
    //     end: new Date(searchWindowEnd * 1000).toISOString()
    //   }
    // });

    const poolData = get(poolStore);
    if (!poolData?.pools?.length) {
      // console.warn('No pools available for price calculation');
      return 0;
    }

    // Get current price and 24h ago price
    const [currentPrice, price24hAgo] = await Promise.all([
      calculateTokenPrice(token, poolData.pools),
      getHistoricalPrice(token)
    ]);

    // console.log(`[${token.symbol}] Price calculation:`, {
    //   currentPrice,
    //   price24hAgo,
    //   change: price24hAgo === 0 ? "No historical data" : ((currentPrice - price24hAgo) / price24hAgo) * 100
    // });

    // If we have no historical data, return "NEW" to indicate a new token
    if (price24hAgo === 0) {
      // console.log(`[${token.symbol}] No historical price data available`);
      return "NEW";
    }

    // If current price is 0, that's a real error
    if (currentPrice === 0) {
      // console.error(`[${token.symbol}] Current price is 0`);
      return 0;
    }

    return ((currentPrice - price24hAgo) / price24hAgo) * 100;
  } catch (error) {
    console.error(`Error calculating 24h price change for ${token.symbol}:`, error);
    return 0;
  }
}

async function calculateTokenPrice(token: FE.Token, pools: BE.Pool[]): Promise<number> {
  // Special case for USDT
  if (token.canister_id === CKUSDT_CANISTER_ID) {
    return 1;
  }

  // Find all pools containing the token
  const relevantPools = pools.filter(pool => 
    pool.address_0 === token.canister_id || 
    pool.address_1 === token.canister_id
  );

  if (relevantPools.length === 0) {
    // console.log(`[${token.symbol}] No relevant pools found`);
    return 0;
  }

  // Calculate prices through different paths
  const pricePaths = await Promise.all([
    calculateDirectUsdtPrice(token, relevantPools),
    calculateIcpPath(token, pools),
  ]);

  // console.log(`[${token.symbol}] Price paths:`, pricePaths);

  // Filter out invalid prices and calculate weighted average
  const validPrices = pricePaths.filter(p => p.price > 0);
  
  if (validPrices.length === 0) {
    // console.log(`[${token.symbol}] No valid prices found`);
    return 0;
  }

  // Calculate weighted average based on liquidity
  const totalWeight = validPrices.reduce((sum, p) => sum + p.weight, 0);
  const weightedPrice = validPrices.reduce((sum, p) => 
    sum + (p.price * p.weight / totalWeight), 0
  );

  // console.log(`[${token.symbol}] Final weighted price:`, {
  //   validPrices,
  //   totalWeight,
  //   weightedPrice
  // });

  return weightedPrice;
}

async function calculateDirectUsdtPrice(
  token: FE.Token, 
  pools: BE.Pool[]
): Promise<{price: number, weight: number}> {
  const usdtPool = pools.find(pool => 
    (pool.address_0 === token.canister_id && pool.address_1 === CKUSDT_CANISTER_ID) ||
    (pool.address_1 === token.canister_id && pool.address_0 === CKUSDT_CANISTER_ID)
  );

  if (!usdtPool) {
    return { price: 0, weight: 0 };
  }

  // If token is token0, use raw price
  // If token is token1, invert the price
  const price = usdtPool.address_0 === token.canister_id ? 
    usdtPool.price : 
    1 / usdtPool.price;

  // console.log(`[${token.symbol}] Direct USDT pool calculation:`, {
  //   pool: usdtPool,
  //   isToken0: usdtPool.address_0 === token.canister_id,
  //   rawPrice: usdtPool.price,
  //   finalPrice: price
  // });

  // Calculate weight based on total liquidity
  const weight = Number(usdtPool.balance_0) + Number(usdtPool.balance_1);

  return { price, weight };
}

async function calculateIcpPath(
  token: FE.Token, 
  pools: BE.Pool[]
): Promise<{price: number, weight: number}> {
  const icpPool = pools.find(pool =>
    (pool.address_0 === token.canister_id && pool.address_1 === ICP_CANISTER_ID) ||
    (pool.address_1 === token.canister_id && pool.address_0 === ICP_CANISTER_ID)
  );

  const icpUsdtPool = pools.find(pool =>
    (pool.address_0 === ICP_CANISTER_ID && pool.address_1 === CKUSDT_CANISTER_ID) ||
    (pool.address_1 === ICP_CANISTER_ID && pool.address_0 === CKUSDT_CANISTER_ID)
  );

  if (!icpPool || !icpUsdtPool) {
    return { price: 0, weight: 0 };
  }

  // Calculate token price in terms of ICP
  const tokenInIcp = icpPool.address_0 === token.canister_id ? 
    icpPool.price : 
    1 / icpPool.price;

  // Calculate ICP price in terms of USDT
  const icpInUsdt = icpUsdtPool.address_0 === ICP_CANISTER_ID ? 
    icpUsdtPool.price : 
    1 / icpUsdtPool.price;

  // Final price is token's ICP price * ICP's USDT price
  const price = tokenInIcp * icpInUsdt;

  // console.log(`[${token.symbol}] ICP path pool calculation:`, {
  //   tokenPool: icpPool,
  //   icpPool: icpUsdtPool,
  //   tokenInIcp,
  //   icpInUsdt,
  //   finalPrice: price
  // });

  // Calculate weight based on total liquidity
  const weight = Number(icpPool.balance_0) + Number(icpPool.balance_1);

  return { price, weight };
}

export async function getHistoricalPrice(token: FE.Token): Promise<number> {
  try {
    // Special case for USDT
    if (token.canister_id === CKUSDT_CANISTER_ID) {
      return 1;
    }

    // Get current time in UTC
    const now = Math.floor(Date.now() / 1000); // Unix timestamp is already UTC
    const yesterday = now - (24 * 60 * 60);
    // Expand search window to ±24 hours to find more data points
    const searchWindowStart = yesterday - (24 * 60 * 60);
    const searchWindowEnd = yesterday + (24 * 60 * 60);
    const tokenId = Number(token.token_id);

    // console.log(`[${token.symbol}] Getting historical price for token_id ${tokenId}:`, {
    //   targetTime: new Date(yesterday * 1000).toISOString(), // toISOString() returns UTC
    //   searchWindow: {
    //     start: new Date(searchWindowStart * 1000).toISOString(),
    //     end: new Date(searchWindowEnd * 1000).toISOString()
    //   }
    // });

    // Helper to get the closest price from candle data
    const getClosestPrice = (data: any[]) => {
      if (!data?.length) {
        // console.log(`[${token.symbol}] No candle data available`);
        return 0;
      }
      
      // Sort by time difference from target time (all timestamps in UTC)
      const sortedData = [...data].sort((a, b) => {
        const aTime = new Date(a.candle_start).getTime() / 1000;
        const bTime = new Date(b.candle_start).getTime() / 1000;
        return Math.abs(aTime - yesterday) - Math.abs(bTime - yesterday);
      });

      // Get the closest data point
      const closest = sortedData[0];
      if (!closest) return 0;

      // Calculate time difference in hours for logging (all in UTC)
      const closestTime = new Date(closest.candle_start).getTime() / 1000;
      const hoursDiff = Math.abs(closestTime - yesterday) / 3600;

      // console.log(`[${token.symbol}] Using candle from ${hoursDiff.toFixed(1)} hours ${closestTime > yesterday ? 'after' : 'before'} target:`, {
      //   candleTime: closest.candle_start, // Already in ISO UTC from API
      //   targetTime: new Date(yesterday * 1000).toISOString(),
      //   candleData: closest
      // });

      // Use close price
      const price = Number(closest.close_price);
      return isNaN(price) ? 0 : price;
    };

    // Try direct USDT path first
    const directUsdtData = await fetchCandleData(tokenId, 1, searchWindowStart, searchWindowEnd);
    // console.log(`[${token.symbol}] Direct USDT data:`, directUsdtData);
    let price = 0;

    if (directUsdtData.length > 0) {
      // Check if token is pay_token or receive_token
      const isPayToken = directUsdtData[0].pay_token_id === tokenId;
      const rawPrice = getClosestPrice(directUsdtData);
      // console.log(`[${token.symbol}] Direct USDT price calculation:`, {
      //   rawPrice,
      //   isPayToken,
      //   finalPrice: isPayToken ? rawPrice : 1 / rawPrice
      // });

      if (rawPrice > 0) {
        // If token is pay_token, use raw price, otherwise invert
        price = isPayToken ? rawPrice : 1 / rawPrice;
      }
    }

    // If no direct USDT price, try via ICP
    if (price === 0) {
      // Get token/ICP and ICP/USDT data
      const [tokenIcpData, icpUsdtData] = await Promise.all([
        fetchCandleData(tokenId, 2, searchWindowStart, searchWindowEnd),
        fetchCandleData(2, 1, searchWindowStart, searchWindowEnd)
      ]);

      // console.log(`[${token.symbol}] ICP path data:`, {
      //   tokenIcpData,
      //   icpUsdtData
      // });

      if (tokenIcpData.length > 0 && icpUsdtData.length > 0) {
        const tokenIcpPrice = getClosestPrice(tokenIcpData);
        const icpUsdtPrice = getClosestPrice(icpUsdtData);

        // console.log(`[${token.symbol}] ICP path raw prices:`, {
        //   tokenIcpPrice,
        //   icpUsdtPrice
        // });

        if (tokenIcpPrice > 0 && icpUsdtPrice > 0) {
          // Convert token/ICP price to USDT terms
          const tokenIsPayToken = tokenIcpData[0].pay_token_id === tokenId;
          const icpIsPayToken = icpUsdtData[0].pay_token_id === 2;

          // Calculate token price in terms of ICP
          const tokenInIcp = tokenIsPayToken ? tokenIcpPrice : 1 / tokenIcpPrice;
          // Calculate ICP price in terms of USDT
          const icpInUsdt = icpIsPayToken ? icpUsdtPrice : 1 / icpUsdtPrice;
          
          // Final price is token's ICP price * ICP's USDT price
          price = tokenInIcp * icpInUsdt;

          // console.log(`[${token.symbol}] ICP path price calculation:`, {
          //   tokenIsPayToken,
          //   icpIsPayToken,
          //   tokenInIcp,
          //   icpInUsdt,
          //   finalPrice: price
          // });
        }
      }
    }

    if (price === 0) {
      // console.warn(`[${token.symbol}] No historical price data found for token ${token.canister_id}`);
    } else {
      // console.log(`[${token.symbol}] Final historical price:`, price);
    }

    return price;
  } catch (error) {
    console.error(`[${token.symbol}] Error getting historical price:`, error);
    return 0;
  }
}