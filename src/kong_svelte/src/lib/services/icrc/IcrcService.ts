import { auth } from "$lib/services/auth";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { Principal } from "@dfinity/principal";
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
      const defaultBalance = await actor.icrc1_balance_of({
          owner: principal,
          subaccount: [],
        })
      // If we don't need separate balances or there's no subaccount, return total
      if (!separateBalances || !subaccount) {
        return defaultBalance;
      }

      // Get subaccount balance with retry logic
      const subaccountBalance = await actor.icrc1_balance_of({
          owner: principal,
          subaccount: [subaccount],
        })

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
    // Add request deduplication with a shorter window and token-specific keys
    const requestKeys = tokens.map(token => 
      `${token.canister_id}-${principal.toString()}-${Date.now() - (Date.now() % 5000)}`
    );
    
    // Check if any of these exact tokens are already being fetched
    const pendingPromises = requestKeys
      .map(key => this.pendingRequests.get(key))
      .filter(Boolean);
    
    if (pendingPromises.length === tokens.length) {
      // All tokens are already being fetched, wait for them
      const results = await Promise.all(pendingPromises);
      return new Map([...results.flatMap(m => [...m.entries()])]);
    }

    // Some or none of the tokens are being fetched, do a fresh fetch
    const promise = this._batchGetBalances(tokens, principal);
    
    // Store the promise for each token
    requestKeys.forEach(key => {
      this.pendingRequests.set(key, promise);
      // Clean up after 5 seconds
      setTimeout(() => this.pendingRequests.delete(key), 200);
    });
    
    try {
      const result = await promise;
      return result;
    } catch (error) {
      console.error('Error in batchGetBalances:', error);
      requestKeys.forEach(key => this.pendingRequests.delete(key));
      return new Map();
    }
  }

  // Add this as a static class property
  private static pendingRequests = new Map<string, Promise<Map<string, bigint>>>();

  private static async _batchGetBalances(
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
      const balances = await this.withConcurrencyLimit(operations, 25);
      
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
    await this.withConcurrencyLimit(subnetOperations, 25);
    return results;
  }

  public static async checkAndRequestIcrc2Allowances(
    token: FE.Token,
    payAmount: bigint,
    spender: string = KONG_BACKEND_PRINCIPAL,
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
        spender,
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
          owner: Principal.fromText(spender),
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
        spender: spender,
        amount: approveArgs.amount,
        timestamp: Date.now(),
      });

      if ("Err" in result) {
        // Convert BigInt values to strings in the error object
        const stringifiedError = JSON.stringify(result.Err, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
        throw new Error(`ICRC2 approve error: ${stringifiedError}`);
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

  /**
   * Creates a subaccount from a principal
   * Implementation based on the example code
   */
  private static createSubAccount(principal: Principal): number[] {
    // Convert principal to bytes
    const bytes = principal.toUint8Array();
    
    // Create a new subaccount with 32 bytes (all zeros)
    const subaccount = new Uint8Array(32);
    
    // Set the first byte to the length of the principal
    subaccount[0] = bytes.length;
    
    // Copy the principal bytes into the subaccount starting at position 1
    subaccount.set(bytes, 1);
    
    return Array.from(subaccount);
  }

  /**
   * Sends ICP to the Cycles Minting Canister (CMC) with a specific memo
   * Used for canister creation and cycle top-up operations
   * 
   * @param amount The amount of ICP to send in E8s (1 ICP = 10^8 E8s)
   * @param principal The principal that will control the created canister
   * @param memo The memo to include in the transaction (default: CREATE_CANISTER memo)
   * @returns A Promise with the transaction result
   */
  public static async transferIcpToCmc(
    amount: bigint,
    principal: Principal | Promise<Principal>,
    memo: bigint = 1095062083n // CREATE_CANISTER memo
  ): Promise<Result<bigint>> {
    try {
      console.log(`[IcrcService][transferIcpToCmc] Starting transfer of ${amount} E8s to CMC`);
      
      // Ensure principal is resolved if it's a Promise
      const resolvedPrincipal = principal instanceof Promise ? await principal : principal;
      
      // Log principal type for debugging
      console.log(`[IcrcService][transferIcpToCmc] Principal type: ${typeof resolvedPrincipal}, value: ${resolvedPrincipal}`);
      
      // Validate that we have a proper Principal object
      if (!resolvedPrincipal || typeof resolvedPrincipal.toString !== 'function') {
        throw new Error(`Invalid principal: ${resolvedPrincipal}`);
      }
      
      // Constants
      // TODO! make this not use "magic" canister ids
      const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai"; // Cycles Minting Canister ID
      const ICP_LEDGER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // ICP Ledger canister ID
      const ICP_FEE = 10000n; // Standard ICP fee in E8s
      
      // Create subaccount from principal using the method from the example code
      const subaccount = this.createSubAccount(resolvedPrincipal);
      
      // Convert memo to byte array
      const memoArray = Array.from(
        new Uint8Array(new BigUint64Array([memo]).buffer)
      );
      
      console.log(`[IcrcService][transferIcpToCmc] Preparing transfer to CMC with memo ${memo}`);
      console.log(`[IcrcService][transferIcpToCmc] Controller principal: ${resolvedPrincipal.toText()}`);
      
      // Get ICP ledger actor
      const ledgerActor = auth.getActor(
        ICP_LEDGER_ID,
        canisterIDLs.icrc1,
        { anon: false, requiresSigning: true }
      );

      // Prepare transfer arguments
      const transferArgs = {
        to: {
          owner: Principal.fromText(CMC_CANISTER_ID),
          subaccount: [subaccount]
        },
        amount: amount - ICP_FEE,
        fee: [ICP_FEE],
        memo: [memoArray],
        from_subaccount: [],
        created_at_time: []
      };
      
      console.log(`[IcrcService][transferIcpToCmc] Executing transfer to CMC`);
      const result = await ledgerActor.icrc1_transfer(transferArgs);
      
      if ("Ok" in result) {
        console.log(`[IcrcService][transferIcpToCmc] Transfer successful, block index: ${result.Ok}`);
      } else {
        console.error(`[IcrcService][transferIcpToCmc] Transfer failed:`, result.Err);
      }
      
      return result;
    } catch (error) {
      console.error("[IcrcService][transferIcpToCmc] Error sending ICP to CMC:", error);
      return { Err: error };
    }
  }
}
