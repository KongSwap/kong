import { browser } from '$app/environment';
import { initWorker, runInBackground, terminateWorker } from './backgroundWorkerService';
import type { BalanceWorkerTaskTypes } from '$lib/workers/balanceWorker';
import { fetchBalance, fetchBalances } from '$lib/api/balances';

// Worker constants
const BALANCE_WORKER_ID = 'balance-worker';
const WORKER_SCRIPT_PATH = '/workers/balanceWorker.js';

// Task type constants (must match those in balanceWorker.ts)
const TASK_TYPES = {
  FETCH_BALANCE: 'FETCH_BALANCE',
  FETCH_BALANCES: 'FETCH_BALANCES'
};

/**
 * Initialize the balance worker
 * This should be called during app initialization
 */
export async function initBalanceWorker(): Promise<void> {
  if (!browser) return;
  
  try {
    await initWorker(BALANCE_WORKER_ID, WORKER_SCRIPT_PATH);
    console.log('Balance worker initialized');
  } catch (error) {
    console.error('Failed to initialize balance worker:', error);
    throw error;
  }
}

/**
 * Fetch a single token balance in the background
 * @param token Token to fetch balance for
 * @param principalId Principal ID of the account
 * @param forceRefresh Whether to force refresh
 * @returns Promise that resolves with the token balance
 */
export async function fetchBalanceInBackground(
  token: Kong.Token,
  principalId?: string,
  forceRefresh = false
): Promise<TokenBalance> {
  if (!browser) {
    throw new Error('Background tasks can only run in the browser');
  }
  
  return runInBackground<
    {token: Kong.Token, principalId?: string, forceRefresh: boolean},
    TokenBalance
  >(
    TASK_TYPES.FETCH_BALANCE,
    { token, principalId, forceRefresh },
    BALANCE_WORKER_ID
  );
}

/**
 * Fetch multiple token balances in the background
 * @param tokens Tokens to fetch balances for
 * @param principalId Principal ID of the account
 * @param forceRefresh Whether to force refresh
 * @returns Promise that resolves with token balances
 */
export async function fetchBalancesInBackground(
  tokens?: Kong.Token[],
  principalId?: string,
  forceRefresh = false
): Promise<Record<string, TokenBalance>> {
  if (!browser) {
    throw new Error('Background tasks can only run in the browser');
  }
  
  return runInBackground<
    {tokens?: Kong.Token[], principalId?: string, forceRefresh: boolean},
    Record<string, TokenBalance>
  >(
    TASK_TYPES.FETCH_BALANCES,
    { tokens, principalId, forceRefresh },
    BALANCE_WORKER_ID
  );
}

/**
 * Terminate the balance worker
 * This should be called during app cleanup
 */
export function terminateBalanceWorker(): void {
  if (!browser) return;
  
  terminateWorker(BALANCE_WORKER_ID);
  console.log('Balance worker terminated');
} 