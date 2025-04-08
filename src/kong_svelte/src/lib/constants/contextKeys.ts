import type { Writable } from 'svelte/store';

// Define the expected types for context values
type PoolStats = { total_volume_24h: number; total_tvl: number; total_fees_24h: number };
type FormatNumberFn = (num: number, precision?: number) => string;
type FormatCountFn = (num: number) => string;

// Define and export context keys
export const POOL_STATS_KEY = Symbol('pool-stats');
export const TOTAL_SWAPS_KEY = Symbol('total-swaps');
export const FORMAT_NUMBER_KEY = Symbol('format-number');
export const FORMAT_COUNT_KEY = Symbol('format-count');

// === Add keys for Tweened Stores ===
export const TWEENED_TVL_KEY = Symbol('tweened-tvl');
export const TWEENED_VOLUME_KEY = Symbol('tweened-volume');
export const TWEENED_FEES_KEY = Symbol('tweened-fees');
export const TWEENED_SWAPS_KEY = Symbol('tweened-swaps');

// Optional: Define interfaces for context values if needed elsewhere
export interface LandingContext {
    poolStats: PoolStats; // Assuming direct $state signal passing
    totalSwaps: number;   // Assuming direct $state signal passing
    formatNumber: FormatNumberFn;
    formatCount: FormatCountFn;
} 