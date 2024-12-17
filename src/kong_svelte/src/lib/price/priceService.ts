import { kongDB } from "$lib/services/db";
import { fetchChartData } from "$lib/services/indexer/api";
import { CKUSDT_CANISTER_ID } from "$lib/constants/canisterConstants";
import { writable } from 'svelte/store';

// Store for price updates
export const priceStore = writable<{[key: string]: number}>({});

// Cache for in-flight requests
const requestCache = new Map<string, Promise<any>>();
const tokenLocks = new Map<string, Promise<void>>();

// Add cache for historical prices at the top with other caches
const historicalPriceCache = new Map<string, {
  price: number;
  timestamp: number;
}>();

// Cache duration for historical prices (e.g. 5 minutes)
const HISTORICAL_PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

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
    const cacheKey = `${payTokenId}-${receiveTokenId}-${startTime}-${endTime}`;
    
    // Wait for any existing requests for this data to complete
    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey);
    }

    // Get token info for logging
    const tokens = await kongDB.tokens.toArray();
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
        start: new Date(startTime).toISOString(),
        end: new Date(endTime).toISOString()
      }
    });
    return [];
  }
}

export async function calculate24hPriceChange(token: FE.Token): Promise<number> {
  try {
    // Get current price
    const currentPrice = Number(token.metrics?.price || 0);
    if (!currentPrice) return 0;

    // Try to get historical price
    const now = Math.floor(Date.now() / 1000);
    const yesterday = now - (24 * 60 * 60);
    const searchWindowStart = yesterday - (4 * 60 * 60);
    const searchWindowEnd = yesterday + (4 * 60 * 60);

    try {
      const historicalPrice = await getHistoricalPrice(
        token,
        yesterday,
        searchWindowStart,
        searchWindowEnd
      );

      // If we couldn't get historical price, return 0
      if (!historicalPrice) return 0;

      // Calculate price change
      return ((currentPrice - historicalPrice) / historicalPrice) * 100;
    } catch (error) {
      console.warn(`Failed to calculate price change for ${token.symbol}:`, error);
      return 0;
    }
  } catch (error) {
    console.error(`Error in calculate24hPriceChange for ${token.symbol}:`, error);
    return 0;
  }
}

// Helper to validate and convert timestamps
function ensureValidTimestamp(timestamp: number): number {
  if (isNaN(timestamp) || timestamp <= 0) return Math.floor(Date.now() / 1000);
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

    // Create cache key using token and target time
    const cacheKey = `${token.canister_id}-${targetTime}`;
    
    // Check cache first
    const cached = historicalPriceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < HISTORICAL_PRICE_CACHE_DURATION) {
      return cached.price;
    }

    // Ensure all timestamps are valid
    targetTime = ensureValidTimestamp(targetTime);
    startTime = ensureValidTimestamp(startTime);
    endTime = ensureValidTimestamp(endTime);

    // Helper function to get closest price from candle data
    const getClosestPrice = (data: any[]): number => {
      if (!data?.length) return 0;
      
      const sortedData = [...data].sort((a, b) => {
        const aTime = apiTimestampToUnix(a.candle_start);
        const bTime = apiTimestampToUnix(b.candle_start);
        return Math.abs(aTime - targetTime) - Math.abs(bTime - targetTime);
      });

      const closest = sortedData[0];
      if (!closest) return 0;

      const price = Number(closest.close_price);
      return isNaN(price) ? 0 : price;
    };

    try {
      // Try direct USDT path first
      const directUsdtData = await fetchCandleData(Number(token.token_id), 1, startTime, endTime);
      let price = 0;

      if (directUsdtData.length > 0) {
        const isPayToken = directUsdtData[0].pay_token_id === Number(token.token_id);
        const rawPrice = getClosestPrice(directUsdtData);

        if (rawPrice > 0) {
          price = isPayToken ? rawPrice : 1 / rawPrice;
        }
      }

      // If no direct USDT price, try via ICP
      if (price === 0) {
        const [tokenIcpData, icpUsdtData] = await Promise.all([
          fetchCandleData(Number(token.token_id), 2, startTime, endTime),
          fetchCandleData(2, 1, startTime, endTime)
        ]);

        if (tokenIcpData.length > 0 && icpUsdtData.length > 0) {
          const tokenIcpPrice = getClosestPrice(tokenIcpData);
          const icpUsdtPrice = getClosestPrice(icpUsdtData);

          if (tokenIcpPrice > 0 && icpUsdtPrice > 0) {
            const tokenIsPayToken = tokenIcpData[0].pay_token_id === Number(token.token_id);
            const icpIsPayToken = icpUsdtData[0].pay_token_id === 2;

            const tokenInIcp = tokenIsPayToken ? tokenIcpPrice : 1 / tokenIcpPrice;
            const icpInUsdt = icpIsPayToken ? icpUsdtPrice : 1 / icpUsdtPrice;
            
            price = tokenInIcp * icpInUsdt;
          }
        }
      }

      // Cache the result before returning
      historicalPriceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      console.warn(`Failed to fetch historical price data for ${token.symbol}:`, error);
      // Return current price as fallback
      return Number(token.metrics?.price || 0);
    }
  } catch (error) {
    console.error(`[${token.symbol}] Error getting historical price:`, error);
    return Number(token.metrics?.price || 0); // Return current price as fallback
  }
}

// Add a function to clear the cache if needed
export function clearHistoricalPriceCache() {
  historicalPriceCache.clear();
}