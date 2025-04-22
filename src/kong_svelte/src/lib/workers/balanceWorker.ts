/// <reference lib="webworker" />

// Balance worker script
// This worker script handles fetching balances in the background

// Define task types
export const TASK_TYPES = {
  FETCH_BALANCE: 'FETCH_BALANCE',
  FETCH_BALANCES: 'FETCH_BALANCES'
};

// TypeScript Worker Context Fix
declare const self: DedicatedWorkerGlobalScope;

// Initialize web worker context
self.onmessage = async (event) => {
  const { taskId, type, data } = event.data;
  
  // Handle initialization
  if (type === 'init') {
    self.postMessage({ type: 'init' });
    return;
  }
  
  try {
    let result;
    
    switch (type) {
      case TASK_TYPES.FETCH_BALANCE:
        result = await handleFetchBalance(data);
        break;
      case TASK_TYPES.FETCH_BALANCES:
        result = await handleFetchBalances(data);
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
    
    self.postMessage({ taskId, result });
  } catch (error) {
    console.error(`Error in worker task ${type}:`, error);
    self.postMessage({ 
      taskId, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

/**
 * Handle the fetch balance task
 * @param data Task data containing the token, principalId, and forceRefresh flag
 */
async function handleFetchBalance(data: { 
  token: any;
  principalId?: string;
  forceRefresh?: boolean;
}): Promise<TokenBalance> {
  try {
    // In a real implementation, you would need to ensure that the balance 
    // functions can be imported and executed in a worker context
    // For now, we'll create a mock implementation
    
    // Mock implementation for demonstration
    const { token, principalId, forceRefresh = false } = data;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      in_tokens: BigInt(0),
      in_usd: "0"
    };
  } catch (error) {
    console.error("Error in handleFetchBalance:", error);
    throw error;
  }
}

/**
 * Handle the fetch balances task
 * @param data Task data containing tokens array, principalId, and forceRefresh flag
 */
async function handleFetchBalances(data: {
  tokens?: any[];
  principalId?: string;
  forceRefresh?: boolean;
}): Promise<Record<string, TokenBalance>> {
  try {
    // Mock implementation for demonstration
    const { tokens = [], principalId, forceRefresh = false } = data;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create a result record with zero balances
    return tokens.reduce((acc, token) => {
      if (token?.address) {
        acc[token.address] = {
          in_tokens: BigInt(0),
          in_usd: "0"
        };
      }
      return acc;
    }, {} as Record<string, TokenBalance>);
  } catch (error) {
    console.error("Error in handleFetchBalances:", error);
    throw error;
  }
}

// Worker TypeScript types
export type BalanceWorkerTaskTypes = typeof TASK_TYPES; 