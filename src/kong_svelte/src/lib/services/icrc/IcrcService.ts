import { auth } from "$lib/services/auth";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { Principal } from "@dfinity/principal";
import { canisterId as kongBackendCanisterId } from "../../../../../declarations/kong_backend";

export class IcrcService {
  private static handleError(methodName: string, error: any) {
    console.error(`Error in ${methodName}:`, error);
    if (
      error?.message?.includes("body") ||
      error?.message?.includes("Wallet connection required")
    ) {
      throw new Error(
        "Please connect your wallet to proceed with this operation.",
      );
    }
    throw error;
  }

  // Add a cache for balance requests
  private static balanceCache: Map<string, {
    balance: bigint;
    timestamp: number;
  }> = new Map();

  private static CACHE_DURATION = 30000; // 30 seconds

  public static async getIcrc1Balance(
    token: FE.Token,
    principal: Principal,
  ): Promise<bigint> {
    try {
      const cacheKey = `${token.canister_id}-${principal.toString()}`;
      const now = Date.now();
      const cached = this.balanceCache.get(cacheKey);

      // Return cached value if still valid
      if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
        return cached.balance;
      }

      const actor = await auth.getActor(
        token.canister_id,
        canisterIDLs["icrc2"],
        { anon: true, requiresSigning: false },
      );
      
      const balance = await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [],
      });

      // Cache the result
      this.balanceCache.set(cacheKey, {
        balance,
        timestamp: now
      });

      return balance;
    } catch (error) {
      console.error(`Error getting ICRC1 balance for ${token.symbol}:`, error);
      return BigInt(0);
    }
  }

  // Add batch balance checking
  public static async batchGetBalances(
    tokens: FE.Token[],
    principal: Principal
  ): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();
    
    // Group tokens by subnet to minimize subnet key fetches
    const tokensBySubnet = tokens.reduce((acc, token) => {
      const subnet = token.canister_id.split('-')[1]; // Simple subnet grouping
      if (!acc.has(subnet)) acc.set(subnet, []);
      acc.get(subnet).push(token);
      return acc;
    }, new Map<string, FE.Token[]>());

    // Fetch balances in parallel for each subnet group
    await Promise.all(
      Array.from(tokensBySubnet.values()).map(async (subnetTokens) => {
        const balances = await Promise.all(
          subnetTokens.map(token => this.getIcrc1Balance(token, principal))
        );
        
        subnetTokens.forEach((token, i) => {
          results.set(token.canister_id, balances[i]);
        });
      })
    );

    return results;
  }

  public static async getIcrc1TokenMetadata(canister_id: string): Promise<any> {
    try {
      const actor = await auth.getActor(canister_id, canisterIDLs.icrc1, {
        anon: true,
        requiresSigning: false,
      });
      return await actor.icrc1_metadata();
    } catch (error) {
      this.handleError("getIcrc1TokenMetadata", error);
    }
  }

  public static async checkAndRequestIcrc2Allowances(
    token: FE.Token,
    payAmount: bigint,
  ): Promise<bigint> {
    if (!token?.canister_id) {
      throw new Error("Invalid token: missing canister_id");
    }

    try {
      // Create actor with retries
      let retries = 3;
      const expiresAt =
        BigInt(Date.now() + 1000 * 60 * 60 * 24 * 29) * BigInt(1000000);

      console.log(`[IcrcService] Checking allowances for token ${token.symbol}:`);
      console.log(`  Pay amount: ${payAmount} (type: ${typeof payAmount})`);
      console.log(`  Token fee: ${token.fee} (type: ${typeof token.fee})`);
      
      const totalAmount = BigInt(payAmount) + BigInt(token.fee.toString().replace('_', ''));
      try {
        console.log(`  Total amount (including fee): ${totalAmount} (type: ${typeof totalAmount})`);
      } catch (error) {
        console.error(`  Error calculating total amount:`, error);
        console.log(`  Raw values for debugging:`);
        console.log(`    payAmount: ${JSON.stringify(payAmount)}`);
        console.log(`    token.fee: ${JSON.stringify(token.fee)}`);
        throw error;
      }

      // First check if we already have sufficient allowance
      const currentAllowance = await this.checkIcrc2Allowance(
        token,
        auth.pnp.account.owner,
        Principal.fromText(kongBackendCanisterId),
      );

      if (currentAllowance >= totalAmount) {
        return currentAllowance;
      }

      const approveArgs = {
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: token?.metrics?.total_supply ? BigInt(token?.metrics?.total_supply) : BigInt(totalAmount) * 10n,
        expected_allowance: [],
        expires_at: [expiresAt],
        spender: {
          owner: Principal.fromText(kongBackendCanisterId),
          subaccount: [],
        },
      };

      console.log("ICRC2_APPROVE ARGS", approveArgs);

      // Fetch balance with retries
      retries = 3;
      while (retries > 0) {
        try {
          let balanceActor = await auth.getActor(
            token.canister_id,
            canisterIDLs.icrc2,
            {
              anon: true,
              requiresSigning: false
            },
          );
          await balanceActor.icrc1_balance_of({
            owner: auth.pnp.account.owner,
            subaccount: [],
          });
          break;
        } catch (error) {
          console.warn(
            `Balance check attempt failed, ${retries - 1} retries left:`,
            error,
          );
          retries--;
          if (retries === 0) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Approve with retries
      let result;
      retries = 3;
      while (retries > 0) {
        try {
          let approveActor = await auth.getActor(token.canister_id, canisterIDLs.icrc2, {
            anon: false,
            requiresSigning: true,
          });
          console.log("ICRC2_APPROVE ACTOR", approveActor);

          result = await approveActor.icrc2_approve(approveArgs);
          console.log("ICRC2_APPROVE RESULT", result);
          break;
        } catch (error) {
          console.warn(
            `Approve attempt failed, ${retries - 1} retries left:`,
            error,
          );
          retries--;
          if (retries === 0) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if ("Err" in result) {
        // Convert BigInt to string in the error object
        const serializedError = JSON.stringify(
          result.Err,
          (key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          2,
        );

        console.error("ICRC2 approve error:", serializedError);
        throw new Error(`ICRC2 approve error: ${serializedError}`);
      }

      return result.Ok;
    } catch (error: any) {
      if (error?.message?.includes("wallet")) {
        throw error; // Pass through wallet connection errors directly
      }
      console.error("ICRC2 approve error:", error);
      this.handleError("checkAndRequestIcrc2Allowances", error);
      throw error;
    }
  }

  public static async checkIcrc2Allowance(
    token: FE.Token,
    owner: Principal,
    spender: Principal,
  ): Promise<bigint> {
    try {
      const actor = await auth.getActor(
        token.canister_id,
        canisterIDLs.icrc2,
        { anon: true, requiresSigning: false },
      );
      console.log("ICRC2_ALLOWANCE ACTOR", actor);
      const result = await actor.icrc2_allowance({
        account: { owner, subaccount: [] },
        spender: {
          owner: spender,
          subaccount: [],
        },
      });
      console.log("ICRC2_ALLOWANCE RESULT", result);
      return BigInt(result.allowance);
    } catch (error) {
      this.handleError("checkIcrc2Allowance", error);
    }
  }

  public static async icrc1Transfer(
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
      const actor = await auth.getActor(token.canister_id, canisterIDLs.icrc1, {
        anon: false,
        requiresSigning: ["nfid"].includes(auth.pnp.activeWallet.id.toLowerCase()) ? true : false,
      });
      console.log("ICRC1_TRANSFER ACTOR", actor);
      const toPrincipal = typeof to === "string" ? Principal.fromText(to) : to;

      const transferArgs = {
        to: {
          owner: toPrincipal,
          subaccount: [],
        },
        amount: BigInt(amount),
        memo: opts.memo ? opts.memo : [],
        fee: opts.fee ? [opts.fee] : [],
        from_subaccount: opts.fromSubaccount ? [opts.fromSubaccount] : [],
        created_at_time: opts.createdAtTime ? [opts.createdAtTime] : [],
      };
      console.log("ICRC1_TRANSFER ARGS", transferArgs);
      const result = await actor.icrc1_transfer(transferArgs);
      console.log("ICRC1_TRANSFER RESULT", result);
      if ("Err" in result) {
        return { Err: result.Err };
      }
      return { Ok: result.Ok };
    } catch (error) {
      this.handleError("icrc1Transfer", error);
    }
  }
}
