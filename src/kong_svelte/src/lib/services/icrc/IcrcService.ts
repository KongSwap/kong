import { auth } from "$lib/services/auth";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { Principal } from "@dfinity/principal";
import { canisterId as kongBackendCanisterId } from "../../../../../declarations/kong_backend";
import { toastStore } from "$lib/stores/toastStore";
import { allowanceStore } from "../tokens/allowanceStore";
import { KONG_BACKEND_PRINCIPAL } from "$lib/constants/canisterConstants";
import { createAnonymousActorHelper } from "$lib/utils/actorUtils";

// Error types for better handling
const enum ErrorType {
  CORS = 'CORS',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  UNKNOWN = 'UNKNOWN'
}

export class IcrcService {
  private static readonly MAX_RETRIES = 5;
  private static readonly INITIAL_DELAY = 1000;
  private static readonly MAX_CONCURRENT_REQUESTS = 3;

  private static classifyError(error: any): ErrorType {
    if (!error) return ErrorType.UNKNOWN;
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('cors') || message.includes('access-control-allow-origin')) {
      return ErrorType.CORS;
    }
    if (message.includes('429') || message.includes('too many requests')) {
      return ErrorType.RATE_LIMIT;
    }
    if (message.includes('network') || message.includes('failed to fetch') || message.includes('net::')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('wallet') || message.includes('authentication')) {
      return ErrorType.AUTH;
    }
    return ErrorType.UNKNOWN;
  }

  private static handleError(methodName: string, error: any) {
    console.error(`Error in ${methodName}:`, error);
    const errorType = this.classifyError(error);
    
    if (errorType === ErrorType.AUTH) {
      throw new Error("Please connect your wallet to proceed with this operation.");
    }
    
    // Let the retry mechanism handle these types of errors
    if (errorType === ErrorType.CORS || errorType === ErrorType.NETWORK || errorType === ErrorType.RATE_LIMIT) {
      throw error;
    }

    throw error;
  }

  private static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES,
    initialDelay: number = this.INITIAL_DELAY
  ): Promise<T> {
    let retries = 0;
    let lastError: any;

    while (retries <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorType = this.classifyError(error);
        
        // Don't retry auth errors
        if (errorType === ErrorType.AUTH) {
          throw error;
        }

        if (retries >= maxRetries) {
          console.error(`Failed after ${retries} retries:`, error);
          throw error;
        }

        // Calculate delay based on error type
        const jitter = Math.random() * 1000;
        let baseDelay = initialDelay;
        
        switch (errorType) {
          case ErrorType.RATE_LIMIT:
            baseDelay = 5000;
            break;
          case ErrorType.CORS:
          case ErrorType.NETWORK:
            baseDelay = 2000;
            break;
        }

        const delay = (baseDelay * Math.pow(1.5, retries)) + jitter;
        console.warn(`Retry ${retries + 1}/${maxRetries} after ${delay}ms due to ${errorType} error`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }

    throw lastError;
  }

  private static async withConcurrencyLimit<T>(
    operations: (() => Promise<T>)[],
    limit: number = this.MAX_CONCURRENT_REQUESTS
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    const queue = [...operations];

    async function executeNext(): Promise<void> {
      if (queue.length === 0) return;
      const operation = queue.shift()!;
      try {
        const result = await operation();
        results.push(result);
      } catch (error) {
        results.push(null as T);
        console.error('Operation failed:', error);
      }
      await executeNext();
    }

    // Start initial batch of operations
    for (let i = 0; i < Math.min(limit, operations.length); i++) {
      executing.push(executeNext());
    }

    await Promise.all(executing);
    return results;
  }

  public static async getIcrc1Balance(
    token: FE.Token,
    principal: Principal,
    subaccount?: number[] | undefined,
    separateBalances: boolean = false
  ): Promise<{ default: bigint, subaccount: bigint } | bigint> {
    try {
      const actor = await createAnonymousActorHelper(
        token.canister_id,
        canisterIDLs.icrc1,
      );

      // Get default balance with retry logic
      const defaultBalance = await this.retryWithBackoff(async () => 
        actor.icrc1_balance_of({
          owner: principal,
          subaccount: [],
        })
      );

      // If we don't need separate balances or there's no subaccount, return total
      if (!separateBalances || !subaccount) {
        return defaultBalance;
      }

      // Get subaccount balance with retry logic
      const subaccountBalance = await this.retryWithBackoff(async () =>
        actor.icrc1_balance_of({
          owner: principal,
          subaccount: [subaccount],
        })
      );

      return {
        default: defaultBalance,
        subaccount: subaccountBalance
      };
    } catch (error) {
      console.error(`Error getting ICRC1 balance for ${token.symbol}:`, error);
      return separateBalances ? { default: BigInt(0), subaccount: BigInt(0) } : BigInt(0);
    }
  }

  public static async batchGetBalances(
    tokens: FE.Token[],
    principal: Principal,
  ): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();
    const subaccount = auth.pnp?.account?.subaccount 
      ? Array.from(auth.pnp.account.subaccount) as number[]
      : undefined;

    // Group tokens by subnet to minimize subnet key fetches
    const tokensBySubnet = tokens.reduce((acc, token) => {
      const subnet = token.canister_id.split("-")[1];
      if (!acc.has(subnet)) acc.set(subnet, []);
      acc.get(subnet).push(token);
      return acc;
    }, new Map<string, FE.Token[]>());

    // Process subnets in parallel with a higher concurrency limit
    const subnetEntries = Array.from(tokensBySubnet.entries());
    const subnetOperations = subnetEntries.map(([subnet, subnetTokens]) => async () => {
      const operations = subnetTokens.map(token => async () => {
        try {
          const balance = await this.getIcrc1Balance(token, principal, subaccount);
          return { token, balance };
        } catch (error) {
          console.error(`Failed to get balance for ${token.symbol}:`, error);
          return { token, balance: BigInt(0) };
        }
      });

      // Increase concurrency limit for token balance fetching
      const balances = await this.withConcurrencyLimit(operations, 10);
      
      balances.forEach(result => {
        if (result) {
          const { token, balance } = result;
          results.set(
            token.canister_id,
            typeof balance === 'bigint' ? balance : balance.default
          );
        }
      });
    });

    // Process all subnets with higher concurrency
    await this.withConcurrencyLimit(subnetOperations, 5);

    return results;
  }

  public static async checkAndRequestIcrc2Allowances(
    token: FE.Token,
    payAmount: bigint,
  ): Promise<bigint | null> {
    if (!token?.canister_id) {
      throw new Error("Invalid token: missing canister_id");
    }

    try {
      const expiresAt =
        BigInt(Date.now() + 1000 * 60 * 60 * 24 * 29) * BigInt(1000000);

      // Calculate total amount including fee
      const tokenFee = token.fee_fixed
        ? BigInt(token.fee_fixed.toString().replace("_", ""))
        : 0n;
      const totalAmount = payAmount + tokenFee;

      // Check current allowance
      const currentAllowance = allowanceStore.getAllowance(
        token.canister_id,
        auth.pnp.account.owner.toString(),
        KONG_BACKEND_PRINCIPAL,
      );

      if (currentAllowance && currentAllowance.amount >= totalAmount) {
        return currentAllowance.amount;
      }

      const approveArgs = {
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: token?.metrics?.total_supply
          ? BigInt(token.metrics.total_supply.toString().replace("_", ""))
          : totalAmount * 10n,
        expected_allowance: [],
        expires_at: [expiresAt],
        spender: {
          owner: Principal.fromText(kongBackendCanisterId),
          subaccount: [],
        },
      };

      const approveActor = auth.pnp.getActor(
        token.canister_id,
        canisterIDLs.icrc2,
        {
          anon: false,
          requiresSigning: true,
        },
      );

      const result = await approveActor.icrc2_approve(approveArgs);
      allowanceStore.addAllowance(token.canister_id, {
        address: token.canister_id,
        wallet_address: auth.pnp.account.owner.toString(),
        spender: KONG_BACKEND_PRINCIPAL,
        amount: approveArgs.amount,
        timestamp: Date.now(),
      });

      if ("Err" in result) {
        throw new Error(`ICRC2 approve error: ${JSON.stringify(result.Err)}`);
      }

      return result.Ok;
    } catch (error) {
      console.error("ICRC2 approve error:", error);
      toastStore.error(`Failed to approve ${token.symbol}: ${error.message}`);
      throw error;
    }
  }

  public static async checkIcrc2Allowance(
    token: FE.Token,
    owner: Principal,
    spender: Principal,
  ): Promise<bigint> {
    try {
      const actor = auth.getActor(token.canister_id, canisterIDLs.icrc2, {
        anon: true,
        requiresSigning: false,
      });
      const result = await actor.icrc2_allowance({
        account: { owner, subaccount: [] },
        spender: {
          owner: spender,
          subaccount: [],
        },
      });
      allowanceStore.addAllowance(token.canister_id, {
        address: token.canister_id,
        wallet_address: owner.toString(),
        spender: spender.toString(),
        amount: BigInt(result.allowance),
        timestamp: Date.now(),
      });
      return BigInt(result.allowance);
    } catch (error) {
      this.handleError("checkIcrc2Allowance", error);
    }
  }

  public static async getTokenFee(token: FE.Token): Promise<bigint> {
    try {
      const actor = await auth.getActor(token.canister_id, canisterIDLs.icrc1, {
        anon: true,
        requiresSigning: false,
      });
      return await actor.icrc1_fee();
    } catch (error) {
      console.error(`Error getting token fee for ${token.symbol}:`, error);
      return BigInt(10000); // Fallback to default fee
    }
  }


  public static async transfer(
    token: FE.Token,
    to: string | Principal,
    amount: bigint,
    opts: {
        memo?: number[];
        fee?: bigint;
        fromSubaccount?: number[];
        createdAtTime?: bigint;
    } = {},
  ): Promise<Result<bigint>> {
    try {
        // If it's an ICP transfer to an account ID
        if (token.symbol === 'ICP' && typeof to === 'string' && to.length === 64) {
            const ledgerActor = auth.getActor(
                token.canister_id, 
                canisterIDLs.ICP,
                { anon: false, requiresSigning: true }
            );
            
            const transfer_args = {
                to: this.hex2Bytes(to),
                amount: { e8s: amount },
                fee: { e8s: BigInt(token.fee_fixed) },
                memo: 0n,
                from_subaccount: opts.fromSubaccount ? [Array.from(opts.fromSubaccount)] : [],
                created_at_time: opts.createdAtTime ? [{ timestamp_nanos: opts.createdAtTime }] : [],
            };

            return await ledgerActor.transfer(transfer_args);
        }

        // For all other cases (ICRC1 transfers to principals)
        const actor = auth.getActor(
            token.canister_id, 
            canisterIDLs["icrc1"],
            { anon: false, requiresSigning: true }
        );

        return await actor.icrc1_transfer({
            to: {
                owner: typeof to === 'string' ? Principal.fromText(to) : to,
                subaccount: []
            },
            amount,
            fee: [BigInt(token.fee_fixed)],
            memo: opts.memo || [],
            from_subaccount: opts.fromSubaccount ? [opts.fromSubaccount] : [],
            created_at_time: opts.createdAtTime ? [opts.createdAtTime] : [],
        });
    } catch (error) {
        console.error("Transfer error:", error);
        return { Err: error };
    }
  }

  // to byte array
  private static hex2Bytes(hex: string): number[] {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }
}
