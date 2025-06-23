import { API_URL } from "$lib/api/index";
import { auth, swapActor, requireWalletConnection } from "$lib/stores/auth";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { toastStore } from "$lib/stores/toastStore";
import { IcrcToken } from "$lib/models/tokens/IcrcToken";
import { canisters, type CanisterType } from "$lib/config/auth.config";
import type { AddLiquiditAmountsResult, RemoveLiquidityAmountsReply } from "../../../../declarations/kong_backend/kong_backend.did";

export const fetchPools = async (params?: any): Promise<{pools: BE.Pool[], total_count: number, total_pages: number, page: number, limit: number}> => {
  try {
    const { page = 1, limit = 50, canisterIds, search = '' } = params || {};
    
    // Build query string for pagination and filters
    const queryParams: Record<string, string> = {
      page: page.toString(),
      limit: limit.toString(),
      t: Date.now().toString() // Cache busting
    };
    
    // Add search if provided
    if (search) {
      queryParams.search = search;
    }
    
    // Add canister_id if provided
    if (canisterIds && canisterIds.length > 0) {
      queryParams.canister_id = canisterIds[0];
    }
    
    const queryString = new URLSearchParams(queryParams).toString();
    
    const response = await fetch(
      `${API_URL}/api/pools?${queryString}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );
   
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error response: ${errorText}`);
      throw new Error(`Failed to fetch pools: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.items) {
      throw new Error("Invalid API response");
    }

    // Helper function: Remove underscores and convert to a numeric value.
    const parseNumericString = (value: string | number): number => {
      if (typeof value === 'number') {
        return value;
      }
      return parseFloat(value.replace(/_/g, ''));
    };

    // Helper function: Parse a single pool data item.
    const parsePoolData = (item: any): BE.Pool => {
      const pool = item.pool;

      // If a StablePool raw_json exists, then parse its numeric fields.
      if (pool.raw_json && pool.raw_json.StablePool) {
        const stablePool = pool.raw_json.StablePool;
        const numericFields = [
          'balance_0',
          'balance_1',
          'lp_fee_0',
          'lp_fee_1',
          'lp_token_id',
          'rolling_24h_volume',
          'rolling_24h_lp_fee',
          'rolling_24h_num_swaps',
          'tvl',
          'kong_fee_0',
          'kong_fee_1'
        ];
        numericFields.forEach(field => {
          if (stablePool[field] !== undefined && typeof stablePool[field] === 'string') {
            stablePool[field] = parseNumericString(stablePool[field]);
          }
        });
        pool.raw_json.StablePool = stablePool;
      }

      // Serialize nested token objects
      const serializedToken0 = item.token0 ? IcrcToken.serializeTokenMetadata(item.token0) : null;
      const serializedToken1 = item.token1 ? IcrcToken.serializeTokenMetadata(item.token1) : null;

      // Return a flat structure combining pool data with token details.
      return {
        ...pool,
        lp_token_id: item.pool.lp_token_id,
        symbol_0: serializedToken0?.symbol,
        address_0: serializedToken0?.address,
        symbol_1: serializedToken1?.symbol,
        address_1: serializedToken1?.address,
        token0: serializedToken0,
        token1: serializedToken1
      } as BE.Pool;
    };

    const transformedItems = data.items.map(parsePoolData);

    // Compute pagination info
    const currentPage = page;
    const currentLimit = limit;
    const total_count = data.total_count || transformedItems.length;
    const total_pages = data.total_pages || Math.ceil(total_count / currentLimit);

    return {
      pools: transformedItems,
      total_count,
      total_pages,
      page: currentPage,
      limit: currentLimit
    };
  } catch (error) {
    console.error('Error fetching pools:', error);
    throw error;
  }
};

export const fetchPoolBalanceHistory = async (poolId: string | number): Promise<any> => {
  try {
    // Use the exact endpoint without any query parameters
    const endpoint = `${API_URL}/api/pools/${poolId}/balance-history`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Try to get more information about the error
      let errorInfo = '';
      try {
        const errorData = await response.text();
        errorInfo = errorData ? ` - ${errorData}` : '';
      } catch (e) {
        // Ignore error parsing error
      }
      
      throw new Error(`Failed to fetch pool balance history: ${response.status} ${response.statusText}${errorInfo}`);
    }
    
    const data = await response.json();
    
    return data;
  } catch (error) {
    console.error('Error fetching pool balance history:', error);
    throw error;
  }
};

export const fetchPoolTotals = async (): Promise<{total_volume_24h: number, total_tvl: number, total_fees_24h: number}> => {
  try {
    const response = await fetch(`${API_URL}/api/pools/totals`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error response: ${errorText}`);
      throw new Error(`Failed to fetch pool totals: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching pool totals:', error);
    // Return default values to prevent UI breakage
    return { total_volume_24h: 0, total_tvl: 0, total_fees_24h: 0 };
  }
}

/**
 * Calculate required amounts for adding liquidity
 */
export async function calculateLiquidityAmounts(
  token0Symbol: string,
  amount0: bigint,
  token1Symbol: string,
): Promise<AddLiquiditAmountsResult> {
  try {
    const actor = swapActor({anon: true});
    const result = await actor.add_liquidity_amounts(
      "IC." + token0Symbol,
      amount0,
      "IC." + token1Symbol,
    );

    if ('Err' in result) {
      throw new Error(result.Err || "Failed to calculate liquidity amounts");
    }

    return result;
  } catch (error) {
    console.error("Error calculating liquidity amounts:", error);
    throw error;
  }
}

/**
 * Calculate amounts that would be received when removing liquidity
 */
export async function calculateRemoveLiquidityAmounts(
  token0CanisterId: string,
  token1CanisterId: string,
  lpTokenAmount: number | bigint,
): Promise<{ amount0: bigint; amount1: bigint; lpFee0: bigint; lpFee1: bigint }> {
  try {
    const lpTokenBigInt =
      typeof lpTokenAmount === "number"
        ? BigInt(Math.floor(lpTokenAmount * 1e8))
        : lpTokenAmount;

    const actor = swapActor({anon: true});
    const result = await (actor as any).remove_liquidity_amounts(
      "IC." + token0CanisterId,
      "IC." + token1CanisterId,
      lpTokenBigInt,
    );

    console.log("result", result);

    if (!result.Ok) {
      throw new Error(result.Err || "Failed to calculate removal amounts");
    }

    // Handle the correct response format based on .did file
    const reply = result.Ok;
    return {
      amount0: BigInt(reply.amount_0),
      amount1: BigInt(reply.amount_1),
      lpFee0: BigInt(reply.lp_fee_0),
      lpFee1: BigInt(reply.lp_fee_1)
    };
  } catch (error) {
    console.error("Error calculating removal amounts:", error);
    throw error;
  }
}

/**
 * Add liquidity to a pool with ICRC2 approval
 */
export async function addLiquidity(params: {
  token_0: Kong.Token;
  amount_0: bigint;
  token_1: Kong.Token;
  amount_1: bigint;
}): Promise<bigint> {
  requireWalletConnection();
  try {
    if (!params.token_0 || !params.token_1) {
      throw new Error("Invalid token configuration");
    }

    let tx_id_0: Array<{ BlockIndex: bigint }> = [];
    let tx_id_1: Array<{ BlockIndex: bigint }> = [];
    let actor;

    // Handle ICRC2 tokens
    if (params.token_0.standards.includes("ICRC-2") && params.token_1.standards.includes("ICRC-2")) {
      const [_approval0, _approval1, actorResult] = await Promise.all([
        IcrcService.checkAndRequestIcrc2Allowances(
          params.token_0,
          params.amount_0,
        ),
        IcrcService.checkAndRequestIcrc2Allowances(
          params.token_1,
          params.amount_1,
        ),
        swapActor({anon: false, requiresSigning: false}),
      ]);

      // For ICRC2 tokens, we don't need to pass transfer block indexes
      tx_id_0 = [];
      tx_id_1 = [];
      actor = actorResult;
    } else {
      console.log("token_0", params.token_0);
      console.log("token_1", params.token_1);
      console.log("adding icrc1 lp");
      // Handle ICRC1 tokens
      const [transfer0Result, transfer1Result, actorResult] = await Promise.all([
        IcrcService.transfer(
          params.token_0,
          canisters.kongBackend.canisterId,
          params.amount_0,
        ),
        IcrcService.transfer(
          params.token_1,
          canisters.kongBackend.canisterId,
          params.amount_1,
        ),
        swapActor({anon: false, requiresSigning: false}),
      ]);

      // Keep block IDs as BigInt
      tx_id_0 = transfer0Result?.Ok ? [{ BlockIndex: transfer0Result.Ok }] : [];
      tx_id_1 = transfer1Result?.Ok ? [{ BlockIndex: transfer1Result.Ok }] : [];
      actor = actorResult;
    }

    const addLiquidityArgs = {
      token_0: "IC." + params.token_0.address,
      amount_0: params.amount_0,
      token_1: "IC." + params.token_1.address,
      amount_1: params.amount_1,
      tx_id_0,
      tx_id_1,
    };

    let result = await actor.add_liquidity_async(addLiquidityArgs);

    if ("Err" in result) {
      throw new Error(result.Err);
    }

    return result.Ok;
  } catch (error) {
    console.error("Error adding liquidity:", error);
    throw error;
  }
}

/**
 * Poll for request status
 * @param requestId The ID of the request to poll.
 * @param successMessage The message to display on successful completion.
 * @param failureMessagePrefix A prefix for failure messages (e.g., "Failed to add liquidity").
 * @param token0Symbol Optional symbol for token 0 for more specific status messages.
 * @param token1Symbol Optional symbol for token 1 for more specific status messages.
 */
export async function pollRequestStatus(
  requestId: bigint,
  successMessage: string,
  failureMessagePrefix: string,
  token0Symbol?: string,
  token1Symbol?: string,
): Promise<any> {
  let attempts = 0;
  const MAX_ATTEMPTS = 50;
  let lastStatus = '';
  let toastId: string | number | undefined;

  try {
    toastId = toastStore.info("Processing transaction..."); // Generic initial message

    while (attempts < MAX_ATTEMPTS) {
      const actor = swapActor({anon: true});
      const result = await actor.requests([requestId]);

      if ('Err' in result) {
        if (toastId !== undefined) toastStore.dismiss(String(toastId));
        throw new Error("Failed to get request status");
      }

      const status = result.Ok[0];

      if (status.statuses && status.statuses.length > 0) {
        const currentStatus = status.statuses[status.statuses.length - 1];
        if (currentStatus !== lastStatus) {
          lastStatus = currentStatus;
          let displayStatus = currentStatus;

          // --- Customize status message based on context and symbols ---
          // Remove Liquidity Specific
          if (currentStatus === "Receiving token 0" && token0Symbol) {
            displayStatus = `Receiving ${token0Symbol}`;
          } else if (currentStatus === "Receiving token 1" && token1Symbol) {
            displayStatus = `Receiving ${token1Symbol}`;
          } else if (currentStatus === "Token 0 received" && token0Symbol) {
            displayStatus = `${token0Symbol} received`;
          } else if (currentStatus === "Token 1 received" && token1Symbol) {
            displayStatus = `${token1Symbol} received`;
          }
          // Add Liquidity Specific (Using confirmed statuses)
          else if (currentStatus === "Sending token 0" && token0Symbol) {
            displayStatus = `Sending ${token0Symbol}`;
          } else if (currentStatus === "Sending token 1" && token1Symbol) {
            displayStatus = `Sending ${token1Symbol}`;
          } else if (currentStatus === "Token 0 deposited" && token0Symbol) {
            displayStatus = `${token0Symbol} deposited`;
          } else if (currentStatus === "Token 1 deposited" && token1Symbol) {
            displayStatus = `${token1Symbol} deposited`;
          }
          // --- End of customization ---

          if (toastId !== undefined) toastStore.dismiss(String(toastId));

          if (displayStatus.includes("Success")) {
            toastId = toastStore.success(successMessage);
          } else if (displayStatus.includes("Failed")) {
            const failureDetail = status.statuses.find(s => s.includes("Failed")) || "Operation failed";
            // Extract reason if possible, otherwise use the full status
            const reason = failureDetail.split(":").pop()?.trim(); 
            const finalFailureMessage = reason ? `${failureMessagePrefix}: ${reason}` : failureDetail;
            toastId = toastStore.error(finalFailureMessage);
          } else {
            toastId = toastStore.info(displayStatus);
          }
        }
      }

      const isSuccess = status.statuses.includes("Success");
      const isFailed = status.statuses.some(s => s.includes("Failed"));

      if (isSuccess) {
        if (!lastStatus.includes("Success")) {
           if (toastId !== undefined) toastStore.dismiss(String(toastId));
           toastStore.success(successMessage);
        }
        return status;
      }

      if (isFailed) {
         if (!lastStatus.includes("Failed")) {
            const failureDetail = status.statuses.find(s => s.includes("Failed")) || "Operation failed";
            const reason = failureDetail.split(":").pop()?.trim();
            const finalFailureMessage = reason ? `${failureMessagePrefix}: ${reason}` : failureDetail;
            if (toastId !== undefined) toastStore.dismiss(String(toastId));
            toastStore.error(finalFailureMessage);
         }
        return status;
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    // Timeout case
    if (toastId !== undefined) toastStore.dismiss(String(toastId));
    toastStore.error(`${failureMessagePrefix}: Operation timed out`);
    throw new Error("Polling timed out");
  } catch (error) {
     if (toastId !== undefined) {
        const finalStates = ["Success", "Failed", "timed out"];
        const isFinalToast = typeof lastStatus === 'string' && finalStates.some(state => lastStatus.includes(state));
        const isFinalError = finalStates.some(state => error.message.includes(state));
        if (!isFinalToast && !isFinalError) {
             toastStore.dismiss(String(toastId));
        }
    }
    
    // Construct a more specific error message
    const finalErrorMessage = `${failureMessagePrefix}: ${error.message || "Error polling request status"}`;
    // Avoid double-toasting known failures
    if (!error.message.includes("Polling timed out") && !error.message.includes("Operation failed")) {
        toastStore.error(finalErrorMessage);
    }
    console.error("Error polling request status:", error);
    // Re-throw with the specific prefix if not already present
    if (!error.message.startsWith(failureMessagePrefix)) {
        throw new Error(finalErrorMessage);
    } else {
        throw error; // Re-throw original error if prefix is already there
    }
  }
}

export async function removeLiquidity(params: {
  token0: string;
  token1: string;
  lpTokenAmount: number | bigint;
}): Promise<string> {
  requireWalletConnection();
  try {
    // Ensure we're using BigInt for the amount
    const lpTokenBigInt =
      typeof params.lpTokenAmount === "number"
        ? BigInt(Math.floor(params.lpTokenAmount * 1e8))
        : params.lpTokenAmount;

    const actor = swapActor({anon: false, requiresSigning: false});
    const result = await (actor as any).remove_liquidity_async({
      token_0: "IC." + params.token0,
      token_1: "IC." + params.token1,
      remove_lp_token_amount: lpTokenBigInt,
    });

    if ('Err' in result) {
      throw new Error(result.Err || "Failed to remove liquidity");
    }
    return result.Ok.toString();
  } catch (error) {
    console.error("Error removing liquidity:", error);
    throw new Error(error.message || "Failed to remove liquidity");
  }
}

export async function approveTokens(token: Kong.Token, amount: bigint) {
  try {
    await IcrcService.checkAndRequestIcrc2Allowances(token, amount);
  } catch (error) {
    console.error("Error approving tokens:", error);
    throw new Error(`Failed to approve ${token.symbol}: ${error.message}`);
  }
}

export async function createPool(params: {
  token_0: Kong.Token;
  amount_0: bigint;
  token_1: Kong.Token;
  amount_1: bigint;
  initial_price: number;
}) {
  requireWalletConnection();
  
  try {
    let tx_id_0: Array<{ BlockIndex: bigint }> = [];
    let tx_id_1: Array<{ BlockIndex: bigint }> = [];
    let actor;

    // Handle ICRC2 tokens
    if (params.token_0.standards.includes("ICRC-2") && params.token_1.standards.includes("ICRC-2")) {
      const [approval0, approval1, actorResult] = await Promise.all([
        IcrcService.checkAndRequestIcrc2Allowances(
          params.token_0,
          params.amount_0,
        ),
        IcrcService.checkAndRequestIcrc2Allowances(
          params.token_1,
          params.amount_1,
        ),
        swapActor({anon: false, requiresSigning: false}),
      ]);

      // For ICRC2 tokens, we don't need to pass transfer block indexes
      tx_id_0 = [];
      tx_id_1 = [];
      actor = actorResult;
    } else {
      // Handle ICRC1 tokens
      const [transfer0Result, transfer1Result, actorResult] = await Promise.all([
        IcrcService.transfer(
          params.token_0,
          canisters.kongBackend.canisterId,
          params.amount_0,
        ),
        IcrcService.transfer(
          params.token_1,
          canisters.kongBackend.canisterId,
          params.amount_1,
        ),
        swapActor({anon: false, requiresSigning: false}),
      ]);

      // Keep block IDs as BigInt
      tx_id_0 = transfer0Result?.Ok ? [{ BlockIndex: transfer0Result.Ok }] : [];
      tx_id_1 = transfer1Result?.Ok ? [{ BlockIndex: transfer1Result.Ok }] : [];
      actor = actorResult;
    }

    const result = await actor.add_pool({
      token_0: "IC." + params.token_0.address,
      amount_0: params.amount_0,
      token_1: "IC." + params.token_1.address,
      amount_1: params.amount_1,
      tx_id_0: tx_id_0,
      tx_id_1: tx_id_1,
      lp_fee_bps: [30] // Hardcoded LP fee basis points
    });

    if ('Err' in result) {
      throw new Error(result.Err);
    }

    return result.Ok;
  } catch (error) {
    console.error("Error creating pool:", error);
    throw new Error(error.message || "Failed to create pool");
  }
}

/**
 * Send LP tokens to another address
 */
export async function sendLpTokens(params: {
  token: string; // LP token ID
  toAddress: string;
  amount: number | bigint;
}): Promise<any> {
  requireWalletConnection();
  try {
    // Ensure we're using BigInt for the amount
    const amountBigInt = typeof params.amount === "number"
      ? BigInt(Math.floor(params.amount * 1e8))
      : params.amount;

    const actor = swapActor({anon: false, requiresSigning: false});

    const result = await actor.send({
      token: params.token,
      to_address: params.toAddress,
      amount: amountBigInt,
    });

    if ('Err' in result) {
      throw new Error(result.Err || "Failed to send LP tokens");
    }

    toastStore.success(`Successfully sent ${params.amount} LP tokens`);
    return result.Ok;
  } catch (error) {
    console.error("Error sending LP tokens:", error);
    toastStore.error(error.message || "Failed to send LP tokens");
    throw error;
  }
}
