import { auth } from "$lib/services/auth";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { Principal } from "@dfinity/principal";
import { canisterId as kongBackendCanisterId } from "../../../../../declarations/kong_backend";
import { toastStore } from "$lib/stores/toastStore";
import { tokenStore } from "$lib/services/tokens/tokenStore";

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

  public static async getIcrc1Balance(
    token: FE.Token,
    principal: Principal,
  ): Promise<bigint> {
    try {
      const actor = await auth.getActor(
        token.canister_id,
        canisterIDLs["icrc2"],
        { anon: true, requiresSigning: false },
      );
      
      return await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [],
      });
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
  ): Promise<bigint | null> {
    if (!token?.canister_id) {
      throw new Error("Invalid token: missing canister_id");
    }

    try {
      const expiresAt = BigInt(Date.now() + 1000 * 60 * 60 * 24 * 29) * BigInt(1000000);

      // Calculate total amount including fee
      const tokenFee = token.fee_fixed ? BigInt(token.fee_fixed.toString().replace('_', '')) : 0n;
      const totalAmount = payAmount + tokenFee;

      // Check current allowance
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
        amount: token?.metrics?.total_supply 
          ? BigInt(token.metrics.total_supply.toString().replace('_', '')) 
          : totalAmount * 10n,
        expected_allowance: [],
        expires_at: [expiresAt],
        spender: {
          owner: Principal.fromText(kongBackendCanisterId),
          subaccount: [],
        },
      };

      console.log("ICRC2_APPROVE ARGS:", {
        ...approveArgs,
        amount: approveArgs.amount.toString(),
        expires_at: approveArgs.expires_at[0].toString(),
      });

      let result;
      let retries = 3;
      while (retries > 0) {
        try {
          toastStore.info(`Approving ${token.symbol}...`);
          let approveActor = await auth.getActor(token.canister_id, canisterIDLs.icrc2, {
            anon: false,
            requiresSigning: true,
          });

          result = await approveActor.icrc2_approve(approveArgs);
          console.log("ICRC2_APPROVE RESULT:", result);
          toastStore.success(`Successfully approved ${token.symbol} for trading`);
          break;
        } catch (error) {
          console.warn(`Approve attempt failed, ${retries - 1} retries left:`, error);
          retries--;
          if (retries === 0) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

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
        requiresSigning: true,
      });

      // Get the token's actual fee from the canister
      const tokenFee = await this.getTokenFee(token);

      const result = await actor.icrc1_transfer({
        to: typeof to === "string" ? { owner: Principal.fromText(to), subaccount: [] } : { owner: to, subaccount: [] },
        amount,
        fee: [tokenFee],  // Use the actual token fee
        memo: opts.memo || [],
        from_subaccount: opts.fromSubaccount || [],
        created_at_time: opts.createdAtTime ? [opts.createdAtTime] : [],
      });

      if ('Ok' in result) {
        // Refresh balance after successful transfer
        const newBalance = await this.getIcrc1Balance(token, auth.pnp.account.owner);
        tokenStore.updateBalances({
          [token.canister_id]: {
            in_tokens: newBalance,
            in_usd: "0" // The USD value will be updated by the store's price update mechanism
          }
        });
      }

      return result;
    } catch (error) {
      return this.handleError("icrc1Transfer", error);
    }
  }
}
