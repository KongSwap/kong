// services/PoolService.ts
import { auth, requireWalletConnection } from "$lib/services/auth";
import { IcrcService } from "../icrc/IcrcService";
import { canisterIDLs } from "../pnp/PnpInitializer";
import { PoolSerializer } from "./PoolSerializer";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { toastStore } from "$lib/stores/toastStore";
import { KONG_BACKEND_CANISTER_ID, KONG_DATA_PRINCIPAL } from "$lib/constants/canisterConstants";

export class PoolService {
  protected static instance: PoolService;
  private static fetchPromise: Promise<UserPoolBalance[]> | null = null;
  private static lastFetchTime = 0;
  private static DEBOUNCE_TIME = 30000; // 30 seconds

  public static getInstance(): PoolService {
    if (!PoolService.instance) {
      PoolService.instance = new PoolService();
    }
    return PoolService.instance;
  }

  // Data Fetching
  public static async fetchPoolsData(): Promise<BE.PoolResponse> {
    try {
      const actor = createAnonymousActorHelper(
        KONG_DATA_PRINCIPAL,
        canisterIDLs.kong_data,
      );
      const result = await actor.pools([]);
      if (!result.Ok) {
        throw new Error("Failed to fetch pools");
      }

      const serializedPools = PoolSerializer.serializePoolsResponse(result.Ok);
      return serializedPools;
    } catch (error) {
      console.error("Error fetching pools:", error);
      throw error;
    }
  }

  // Pool Operations
  public static async getPoolDetails(
    poolId: string | number,
  ): Promise<BE.Pool> {
    try {
      const actor = await auth.pnp.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
      );

      // Ensure we have a number for the pool ID
      const numericPoolId =
        typeof poolId === "string" ? parseInt(poolId) : poolId;
      if (isNaN(numericPoolId)) {
        throw new Error(`Invalid pool ID: ${poolId}`);
      }

      const pool = await actor.get_by_pool_id(numericPoolId);

      if (!pool) {
        throw new Error(`Pool ${poolId} not found`);
      }

      return pool;
    } catch (error) {
      console.error("[PoolService] Error fetching pool details:", error);
      throw error;
    }
  }

  /**
   * Calculate required amounts for adding liquidity
   */
  public static async calculateLiquidityAmounts(
    token0Symbol: string,
    amount0: bigint,
    token1Symbol: string,
  ): Promise<any> {
    try {
      const actor = createAnonymousActorHelper(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
      );
      const result = await actor.add_liquidity_amounts(
        "IC." + token0Symbol,
        amount0,
        "IC." + token1Symbol,
      );

      if (!result.Ok) {
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
  public static async calculateRemoveLiquidityAmounts(
    token0CanisterId: string,
    token1CanisterId: string,
    lpTokenAmount: number | bigint,
  ): Promise<[bigint, bigint]> {
    try {
      const lpTokenBigInt =
        typeof lpTokenAmount === "number"
          ? BigInt(Math.floor(lpTokenAmount * 1e8))
          : lpTokenAmount;

      const actor = await auth.pnp.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: true, requiresSigning: false },
      );

      const result = await actor.remove_liquidity_amounts(
        "IC." + token0CanisterId,
        "IC." + token1CanisterId,
        lpTokenBigInt,
      );

      if (!result.Ok) {
        throw new Error(result.Err || "Failed to calculate removal amounts");
      }

      // Handle the correct response format based on .did file
      const reply = result.Ok;
      return [BigInt(reply.amount_0), BigInt(reply.amount_1)];
    } catch (error) {
      console.error("Error calculating removal amounts:", error);
      throw error;
    }
  }

  public static async addLiquidityAmounts(
    token0Symbol: string,
    amount0: bigint,
    token1Symbol: string,
  ): Promise<any> {
    return this.calculateLiquidityAmounts(token0Symbol, amount0, token1Symbol);
  }

  /**
   * Add liquidity to a pool with ICRC2 approval
   */
  public static async addLiquidity(params: {
    token_0: FE.Token;
    amount_0: bigint;
    token_1: FE.Token;
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
      if (params.token_0.icrc2 && params.token_1.icrc2) {
        const [_approval0, _approval1, actorResult] = await Promise.all([
          IcrcService.checkAndRequestIcrc2Allowances(
            params.token_0,
            params.amount_0,
          ),
          IcrcService.checkAndRequestIcrc2Allowances(
            params.token_1,
            params.amount_1,
          ),
          auth.pnp.getActor(KONG_BACKEND_CANISTER_ID, canisterIDLs.kong_backend, {
            anon: false,
            requiresSigning: false,
          }),
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
            KONG_BACKEND_CANISTER_ID,
            params.amount_0,
          ),
          IcrcService.transfer(
            params.token_1,
            KONG_BACKEND_CANISTER_ID,
            params.amount_1,
          ),
          auth.pnp.getActor(KONG_BACKEND_CANISTER_ID, canisterIDLs.kong_backend, {
            anon: false,
            requiresSigning: false,
          }),
        ]);

        // Keep block IDs as BigInt
        tx_id_0 = transfer0Result?.Ok ? [{ BlockIndex: transfer0Result.Ok }] : [];
        tx_id_1 = transfer1Result?.Ok ? [{ BlockIndex: transfer1Result.Ok }] : [];
        actor = actorResult;
      }

      const addLiquidityArgs = {
        token_0: "IC." + params.token_0.canister_id,
        amount_0: params.amount_0,
        token_1: "IC." + params.token_1.canister_id,
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
   */
  public static async pollRequestStatus(requestId: bigint): Promise<any> {
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    let lastStatus = '';
    
    const toastId = toastStore.info(
      "Processing liquidity operation...",
    );

    try {
      while (attempts < MAX_ATTEMPTS) {
        const actor = await auth.pnp.getActor(
          KONG_BACKEND_CANISTER_ID,
          canisterIDLs.kong_backend,
          { anon: true }
        );
        const result = await actor.requests([requestId]);

        if (!result.Ok || result.Ok.length === 0) {
          toastStore.dismiss(toastId);
          throw new Error("Failed to get request status");
        }

        const status = result.Ok[0];
        
        // Show status updates in toast
        if (status.statuses && status.statuses.length > 0) {
          const currentStatus = status.statuses[status.statuses.length - 1];
          if (currentStatus !== lastStatus) {
            lastStatus = currentStatus;
            if(currentStatus.includes("Success")) {
              toastStore.success(currentStatus);
            } else {
              toastStore.info(currentStatus);
            }
          }
        }

        // Check for success
        if (status.statuses.includes("Success")) {
          toastStore.dismiss(toastId);
          return status;
        }

        // Check for failure
        if (status.statuses.find(s => s.includes("Failed"))) {
          const failureMessage = status.statuses.find(s => s.includes("Failed"));
          toastStore.dismiss(toastId);
          toastStore.error(failureMessage || "Operation failed");
          return status;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 500)); // .5 second delay between polls
      }

      // If we exit the loop without success/failure
      toastStore.dismiss(toastId);
      toastStore.error("Operation timed out");
      throw new Error("Polling timed out");
    } catch (error) {
      toastStore.dismiss(toastId);
      toastStore.error(error.message || "Error polling request status");
      console.error("Error polling request status:", error);
      throw error;
    }
  }

  public static async removeLiquidity(params: {
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

      const actor = await auth.pnp.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: false, requiresSigning: false },
      );
      const result = await actor.remove_liquidity_async({
        token_0: "IC." + params.token0,
        token_1: "IC." + params.token1,
        remove_lp_token_amount: lpTokenBigInt,
      });

      if (!result.Ok) {
        throw new Error(result.Err || "Failed to remove liquidity");
      }
      return result.Ok.toString();
    } catch (error) {
      console.error("Error removing liquidity:", error);
      throw new Error(error.message || "Failed to remove liquidity");
    }
  }

  static async getPool(token0: string, token1: string): Promise<BE.Pool | null> {
    try {
      const actor = createAnonymousActorHelper(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend
      );
      
      // Use get_by_tokens instead of get_pool
      const result = await actor.get_by_tokens("IC." + token0, "IC." + token1);
      return result || null;
    } catch (err) {
      console.error("Error getting pool:", err);
      return null;
    }
  }

  static async approveTokens(token: FE.Token, amount: bigint) {
    try {
      await IcrcService.checkAndRequestIcrc2Allowances(token, amount);
    } catch (error) {
      console.error("Error approving tokens:", error);
      throw new Error(`Failed to approve ${token.symbol}: ${error.message}`);
    }
  }

  static async createPool(params: {
    token_0: FE.Token;
    amount_0: bigint;
    token_1: FE.Token;
    amount_1: bigint;
    initial_price: number;
  }) {
    requireWalletConnection();
    
    try {
      let tx_id_0: Array<{ BlockIndex: bigint }> = [];
      let tx_id_1: Array<{ BlockIndex: bigint }> = [];
      let actor;

      // Handle ICRC2 tokens
      if (params.token_0.icrc2 && params.token_1.icrc2) {
        const [approval0, approval1, actorResult] = await Promise.all([
          IcrcService.checkAndRequestIcrc2Allowances(
            params.token_0,
            params.amount_0,
          ),
          IcrcService.checkAndRequestIcrc2Allowances(
            params.token_1,
            params.amount_1,
          ),
          auth.pnp.getActor(KONG_BACKEND_CANISTER_ID, canisterIDLs.kong_backend, {
            anon: false,
            requiresSigning: false,
          }),
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
            KONG_BACKEND_CANISTER_ID,
            params.amount_0,
          ),
          IcrcService.transfer(
            params.token_1,
            KONG_BACKEND_CANISTER_ID,
            params.amount_1,
          ),
          auth.pnp.getActor(KONG_BACKEND_CANISTER_ID, canisterIDLs.kong_backend, {
            anon: false,
            requiresSigning: false,
          }),
        ]);

        // Keep block IDs as BigInt
        tx_id_0 = transfer0Result?.Ok ? [{ BlockIndex: transfer0Result.Ok }] : [];
        tx_id_1 = transfer1Result?.Ok ? [{ BlockIndex: transfer1Result.Ok }] : [];
        actor = actorResult;
      }

      const result = await actor.add_pool({
        token_0: "IC." + params.token_0.canister_id,
        amount_0: params.amount_0,
        token_1: "IC." + params.token_1.canister_id,
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
}
