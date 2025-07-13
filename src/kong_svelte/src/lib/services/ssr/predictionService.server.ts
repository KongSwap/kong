/**
 * Server-side service for SSR data fetching
 * Optimized for performance with caching and timeouts
 */
import { createAnonymousActorHelper } from '$lib/utils/actorUtils';
import { idlFactory as predictionsIdl } from '../../../../../declarations/prediction_markets_backend';
import { canisterId as PREDICTIONS_CANISTER_ID } from '../../../../../declarations/prediction_markets_backend';
import { KONG_LEDGER_CANISTER_ID } from '$lib/constants/canisterConstants';
import type { ActorSubclass } from '@dfinity/agent';

// Simple in-memory cache for actors (reused across requests)
const actorCache = new Map<string, ActorSubclass<any>>();

// Cache for frequently accessed data with TTL
interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const dataCache = new Map<string, CachedData<any>>();

/**
 * Get or create a cached actor
 */
function getCachedActor<T>(
  canisterId: string, 
  idlFactory: any,
  key: string
): ActorSubclass<T> {
  if (!actorCache.has(key)) {
    const actor = createAnonymousActorHelper(canisterId, idlFactory);
    actorCache.set(key, actor);
  }
  return actorCache.get(key) as ActorSubclass<T>;
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
  fallback?: T
): Promise<T> {
  const timeout = new Promise<T>((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
  );
  
  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    console.error('SSR fetch timeout:', error);
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

/**
 * Get data with caching
 */
function getCachedData<T>(key: string, ttlMs: number): T | null {
  const cached = dataCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > cached.ttl) {
    dataCache.delete(key);
    return null;
  }
  
  return cached.data;
}

/**
 * Set cached data
 */
function setCachedData<T>(key: string, data: T, ttlMs: number): void {
  dataCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

/**
 * Fetch active markets with SSR optimization
 */
export async function getActiveMarketsSSR(limit = 50) {
  const cacheKey = `markets:active:${limit}`;
  const cached = getCachedData(cacheKey, 60000); // 1 minute cache
  if (cached) return cached;

  try {
    const actor = getCachedActor(
      PREDICTIONS_CANISTER_ID,
      predictionsIdl,
      'predictions'
    );
    
    // Use get_all_markets with Active status filter
    const result = await fetchWithTimeout(
      actor.get_all_markets({
        start: 0n,
        length: BigInt(limit),
        status_filter: [{ Active: null }],
        sort_option: [{ CreatedAt: { Descending: null } }]
      }),
      5000,
      { markets: [], total: 0n }
    );
    
    const serializedMarkets = serializeICData(result.markets || []);
    setCachedData(cacheKey, serializedMarkets, 60000);
    return serializedMarkets;
  } catch (error) {
    console.error('Failed to fetch markets for SSR:', error);
    return [];
  }
}

/**
 * Fetch single market with SSR optimization
 */
export async function getMarketSSR(marketId: bigint) {
  const cacheKey = `market:${marketId}`;
  const cached = getCachedData(cacheKey, 30000); // 30 second cache
  if (cached) return cached;

  try {
    const actor = getCachedActor(
      PREDICTIONS_CANISTER_ID,
      predictionsIdl,
      'predictions'
    );
    
    const market = await fetchWithTimeout(
      actor.get_market(marketId),
      3000
    );
    
    if (market && market[0]) {
      // Serialize the market data before caching
      const serializedMarket = [serializeICData(market[0])];
      setCachedData(cacheKey, serializedMarket, 30000);
      return serializedMarket;
    }
    
    return market;
  } catch (error) {
    console.error('Failed to fetch market for SSR:', error);
    return [null];
  }
}

/**
 * Fetch market bets with pagination
 */
export async function getMarketBetsSSR(marketId: bigint, limit = 20) {
  try {
    const actor = getCachedActor(
      PREDICTIONS_CANISTER_ID,
      predictionsIdl,
      'predictions'
    );
    
    // Don't cache bets as they change frequently
    const bets = await fetchWithTimeout(
      actor.get_market_bets(marketId),
      3000,
      []
    );
    
    // Serialize and return only the requested number of bets
    return serializeICData(bets.slice(0, limit));
  } catch (error) {
    console.error('Failed to fetch bets for SSR:', error);
    return [];
  }
}

/**
 * Fetch token info for SSR
 */
export async function getTokenInfoSSR(tokenIds: string[]) {
  // For now, return static KONG token info
  // In production, this would fetch from token canisters
  if (tokenIds.includes(KONG_LEDGER_CANISTER_ID)) {
    return [{
      id: KONG_LEDGER_CANISTER_ID,
      name: 'KONG',
      symbol: 'KONG',
      decimals: 8,
      logo: '/tokens/kong.svg'
    }];
  }
  return [];
}

/**
 * Batch fetch data for prediction list page
 */
export async function getPredictionListDataSSR() {
  const [markets, recentBets, kongToken] = await Promise.all([
    getActiveMarketsSSR(50),
    fetchWithTimeout(getLatestBetsSSR(), 3000, []),
    getTokenInfoSSR([KONG_LEDGER_CANISTER_ID]).then(tokens => tokens[0])
  ]);
  
  return {
    markets,
    recentBets,
    kongToken
  };
}

/**
 * Batch fetch data for individual market page
 */
export async function getMarketDetailDataSSR(marketId: string) {
  const marketIdBigInt = BigInt(marketId);
  
  const [marketResult, supportedTokens, initialBets] = await Promise.all([
    getMarketSSR(marketIdBigInt),
    getSupportedTokensSSR(),
    getMarketBetsSSR(marketIdBigInt, 20)
  ]);
  
  const market = marketResult[0];
  const marketTokenInfo = market?.token_id 
    ? supportedTokens.find(t => t.id === market.token_id) 
    : null;
  
  return {
    market,
    marketTokenInfo,
    supportedTokens,
    initialBets
  };
}

/**
 * Get latest bets across all markets
 */
async function getLatestBetsSSR(limit = 10) {
  try {
    const actor = getCachedActor(
      PREDICTIONS_CANISTER_ID,
      predictionsIdl,
      'predictions'
    );
    
    // get_latest_bets doesn't take any arguments
    const bets = await fetchWithTimeout(
      actor.get_latest_bets(),
      3000,
      []
    );
    // Limit the results if needed
    const limitedBets = bets.slice(0, limit);
    return serializeICData(limitedBets);
  } catch (error) {
    console.error('Failed to fetch latest bets for SSR:', error);
    return [];
  }
}

/**
 * Get supported tokens from backend
 */
async function getSupportedTokensSSR() {
  const cacheKey = 'supported-tokens';
  const cached = getCachedData(cacheKey, 600000); // 10 minute cache
  if (cached) return cached;

  try {
    const actor = getCachedActor(
      PREDICTIONS_CANISTER_ID,
      predictionsIdl,
      'predictions'
    );
    
    const tokens = await fetchWithTimeout(
      actor.get_supported_tokens(),
      3000,
      []
    );
    
    const serializedTokens = serializeICData(tokens);
    setCachedData(cacheKey, serializedTokens, 600000);
    return serializedTokens;
  } catch (error) {
    console.error('Failed to fetch supported tokens for SSR:', error);
    return [];
  }
}

/**
 * Helper to serialize IC data types for SSR
 */
function serializeICData(data: any): any {
  if (data === null || data === undefined) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(serializeICData);
  }
  
  // Handle Principal objects
  if (data && typeof data === 'object' && data._isPrincipal) {
    return data.toString();
  }
  
  // Handle BigInt
  if (typeof data === 'bigint') {
    // For IDs and timestamps, convert to string to preserve precision
    return data.toString();
  }
  
  // Handle objects
  if (data && typeof data === 'object' && data.constructor === Object) {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeICData(value);
    }
    return result;
  }
  
  return data;
}

/**
 * Clear expired cache entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, cached] of dataCache.entries()) {
    if (now - cached.timestamp > cached.ttl) {
      dataCache.delete(key);
    }
  }
}, 60000); // Clean every minute