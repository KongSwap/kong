import { get } from 'svelte/store';
import { userTokens } from "$lib/stores/userTokens";
import { 
  initBalanceWorker, 
  fetchBalancesInBackground, 
  terminateBalanceWorker 
} from './backgroundBalanceService';

/**
 * Example of how to initialize and use the background worker service
 * 
 * @param principalId The user's principal ID
 * @returns Balance results
 */
export async function loadBalancesInBackground(principalId: string) {
  try {
    // Initialize the worker if it hasn't been initialized yet
    await initBalanceWorker();
    
    // Get the user's tokens
    const tokens = get(userTokens.tokens);
    
    // Fetch balances in the background
    const balances = await fetchBalancesInBackground(tokens, principalId);
    
    return balances;
  } catch (error) {
    console.error('Error loading balances in background:', error);
    throw error;
  }
}

/**
 * Example of how to use the background worker in an app lifecycle
 */
export function setupBackgroundServices() {
  // Initialize services on app startup
  if (typeof window !== 'undefined') {
    // Initialize background workers
    initBalanceWorker().catch(error => {
      console.error('Failed to initialize background workers:', error);
    });
    
    // Set up cleanup on window unload
    window.addEventListener('beforeunload', () => {
      // Terminate workers
      terminateBalanceWorker();
    });
  }
}

/**
 * Example function showing how to initialize the worker from a layout or root component
 * This should be called in your app's layout or root component's onMount
 */
export function initBackgroundServices() {
  setupBackgroundServices();
} 