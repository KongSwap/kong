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
  try {
    // Ensure timestamps are valid and in seconds
    startTime = ensureValidTimestamp(startTime);
    endTime = ensureValidTimestamp(endTime);

    // Convert to ISO strings
    const startTimeUTC = new Date(startTime * 1000).toISOString();
    const endTimeUTC = new Date(endTime * 1000).toISOString();

    const cacheKey = `${payTokenId}-${receiveTokenId}-${startTime}-${endTime}`;
    
    // Wait for any existing requests for this data to complete
    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey);
    }

    // Get token info for logging
    const tokens = await kongDB.tokens.toArray();
    const payToken = tokens.find(t => Number(t.token_id) === payTokenId);
    const receiveToken = tokens.find(t => Number(t.token_id) === receiveTokenId);
    
    // console.log(`[${payToken?.symbol || payTokenId}/${receiveToken?.symbol || receiveTokenId}] Fetching candle data:`, {
    //   startTime: startTimeUTC,
    //   endTime: endTimeUTC,
    //   timestamps: {
    //     startUnix: startTime,
    //     endUnix: endTime
    //   }
    // });
    
    const promise = fetchChartData(payTokenId, receiveTokenId, startTime, endTime, "1D")
      .finally(() => {
        if (requestCache.get(cacheKey) === promise) {
          requestCache.delete(cacheKey);
        }
      });
    
    requestCache.set(cacheKey, promise);
    return promise;
  } catch (error) {
    console.error(`Error fetching candle data:`, {
      error,
      payTokenId,
      receiveTokenId,
      timestamps: {
        start: new Date(startTime * 1000).toISOString(),
        end: new Date(endTime * 1000).toISOString()
      }
    });
    return [];
  }
}

export async function calculate24hPriceChange(token: FE.Token): Promise<number | string> {
  await acquireTokenLock(token.canister_id);
  
  try {
    // Get current time and ensure UTC handling
    const now = new Date();
    const nowUTC = Math.floor(now.getTime() / 1000);
    
    // Calculate exactly 24 hours ago
    const yesterdayUTC = nowUTC - (24 * 60 * 60);
    
    // Use a smaller window to ensure we get closer to the exact 24h ago price
    const searchWindowStartUTC = yesterdayUTC - (4 * 60 * 60); // ±4 hours
    const searchWindowEndUTC = yesterdayUTC + (4 * 60 * 60);

    // console.log(`[${token.symbol}] Time windows for price calculation:`, {
    //   symbol: token.symbol,
    //   currentTime: new Date(nowUTC * 1000).toISOString(),
    //   targetTime: new Date(yesterdayUTC * 1000).toISOString(),
    //   searchWindow: {
    //     start: new Date(searchWindowStartUTC * 1000).toISOString(),
    //     end: new Date(searchWindowEndUTC * 1000).toISOString()
    //   }
    // });

    const poolData = get(poolStore);
    if (!poolData?.pools?.length) {
      return 0;
    }

    const [currentPrice, price24hAgo] = await Promise.all([
      calculateTokenPrice(token, poolData.pools),
      getHistoricalPrice(token, yesterdayUTC, searchWindowStartUTC, searchWindowEndUTC)
    ]);

    // console.log(`[${token.symbol}] Price comparison:`, {
    //   symbol: token.symbol,
    //   currentPrice,
    //   price24hAgo,
    //   percentageChange: price24hAgo === 0 ? "NEW" : ((currentPrice - price24hAgo) / price24hAgo) * 100
    // });

    if (price24hAgo === 0) {
      return "NEW";
    }

    if (currentPrice === 0) {
      return 0;
    }

    return ((currentPrice - price24hAgo) / price24hAgo) * 100;
  } catch (error) {
    console.error(`Error calculating 24h price change for ${token.symbol}:`, error);
    return 0;
  }
}

// Helper to validate and convert timestamps
function ensureValidTimestamp(timestamp: number): number {
  // If timestamp is 0 or negative, return current time
  if (timestamp <= 0) return Math.floor(Date.now() / 1000);
  // If timestamp is in milliseconds, convert to seconds
  if (timestamp > 1e10) return Math.floor(timestamp / 1000);
  return Math.floor(timestamp);
}

// Helper to convert API timestamp to Unix seconds
function apiTimestampToUnix(timestamp: number | string): number {
  if (typeof timestamp === 'string') {
    return Math.floor(new Date(timestamp).getTime() / 1000);
  }
  // If timestamp is in milliseconds (>1e10), convert to seconds
  if (timestamp > 1e10) {
    return Math.floor(timestamp / 1000);
  }
  return Math.floor(timestamp);
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

export async function getHistoricalPrice(
  token: FE.Token, 
  targetTime: number,
  startTime: number,
  endTime: number
): Promise<number> {
  try {
    if (token.canister_id === CKUSDT_CANISTER_ID) {
      return 1;
    }

    // Ensure all timestamps are valid
    targetTime = ensureValidTimestamp(targetTime);
    startTime = ensureValidTimestamp(startTime);
    endTime = ensureValidTimestamp(endTime);

    const tokenId = Number(token.token_id);

    // Log the exact candle we're using
    const getClosestPrice = (data: any[]) => {
      if (!data?.length) return 0;
      
      const sortedData = [...data].sort((a, b) => {
        // Convert API timestamps to Unix seconds
        const aTime = apiTimestampToUnix(a.candle_start);
        const bTime = apiTimestampToUnix(b.candle_start);
        return Math.abs(aTime - targetTime) - Math.abs(bTime - targetTime);
      });

      const closest = sortedData[0];
      if (!closest) return 0;

      const closestTime = apiTimestampToUnix(closest.candle_start);
      const hoursDiff = Math.abs(closestTime - targetTime) / 3600;

      // console.log(`[${token.symbol}] Selected historical candle:`, {
      //   symbol: token.symbol,
      //   candleTime: new Date(closestTime * 1000).toISOString(),
      //   targetTime: new Date(targetTime * 1000).toISOString(),
      //   hoursDifference: hoursDiff,
      //   candleData: {
      //     ...closest,
      //     candle_start: new Date(closestTime * 1000).toISOString()
      //   }
      // });

      const price = Number(closest.close_price);
      return isNaN(price) ? 0 : price;
    };

    // Try direct USDT path first
    const directUsdtData = await fetchCandleData(tokenId, 1, startTime, endTime);
    let price = 0;

    if (directUsdtData.length > 0) {
      const isPayToken = directUsdtData[0].pay_token_id === tokenId;
      const rawPrice = getClosestPrice(directUsdtData);

      if (rawPrice > 0) {
        price = isPayToken ? rawPrice : 1 / rawPrice;
      }
    }

    // console.log(`[${token.symbol}] Historical price - Direct USDT path:`, {
    //   symbol: token.symbol,
    //   price,
    //   rawData: directUsdtData
    // });

    // If no direct USDT price, try via ICP
    if (price === 0) {
      const [tokenIcpData, icpUsdtData] = await Promise.all([
        fetchCandleData(tokenId, 2, startTime, endTime),
        fetchCandleData(2, 1, startTime, endTime)
      ]);

      if (tokenIcpData.length > 0 && icpUsdtData.length > 0) {
        const tokenIcpPrice = getClosestPrice(tokenIcpData);
        const icpUsdtPrice = getClosestPrice(icpUsdtData);

        if (tokenIcpPrice > 0 && icpUsdtPrice > 0) {
          const tokenIsPayToken = tokenIcpData[0].pay_token_id === tokenId;
          const icpIsPayToken = icpUsdtData[0].pay_token_id === 2;

          const tokenInIcp = tokenIsPayToken ? tokenIcpPrice : 1 / tokenIcpPrice;
          const icpInUsdt = icpIsPayToken ? icpUsdtPrice : 1 / icpUsdtPrice;
          
          price = tokenInIcp * icpInUsdt;

          console.log(`[${token.symbol}] Historical price - ICP path:`, {
            symbol: token.symbol,
            price,
            tokenIcpData,
            icpUsdtData,
            tokenIcpPrice,
            icpUsdtPrice,
            tokenInIcp,
            icpInUsdt
          });
        }
      }
    }

    // if (price === 0) {
    //   console.log(`[${token.symbol}] No price found through any path for token:`, {
    //     symbol: token.symbol,
    //     canisterId: token.canister_id
    //   });
    // }

    return price;
  } catch (error) {
    console.error(`[${token.symbol}] Error getting historical price:`, error);
    return 0;
  }
}