import { auth } from "$lib/services/auth";
import { canisterIDLs } from "$lib/services/pnp/PnpInitializer";
import { Principal } from "@dfinity/principal";
import { canisterId as kongBackendCanisterId } from "../../../../../declarations/kong_backend";
import { toastStore } from "$lib/stores/toastStore";
import { allowanceStore } from "../tokens/allowanceStore";
import { KONG_BACKEND_PRINCIPAL } from "$lib/constants/canisterConstants";

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
    subaccount?: number[] | undefined,
    separateBalances: boolean = false
  ): Promise<{ default: bigint, subaccount: bigint } | bigint> {
    try {
      const actor = await auth.getActor(
        token.canister_id,
        canisterIDLs["icrc2"],
        { anon: true, requiresSigning: false },
      );

      // Get default balance
      const defaultBalance = await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [],
      });

      // If we don't need separate balances or there's no subaccount, return total
      if (!separateBalances || !subaccount) {
        return defaultBalance;
      }

      // Get subaccount balance
      const subaccountBalance = await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [subaccount],
      });

      return {
        default: defaultBalance,
        subaccount: subaccountBalance
      };
    } catch (error) {
      console.error(`Error getting ICRC1 balance for ${token.symbol}:`, error);
      return separateBalances ? { default: BigInt(0), subaccount: BigInt(0) } : BigInt(0);
    }
  }

  // Add batch balance checking
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

    // Fetch balances in parallel for each subnet group
    await Promise.all(
      Array.from(tokensBySubnet.values()).map(async (subnetTokens) => {
        const balances = await Promise.all(
          subnetTokens.map((token) => 
            this.getIcrc1Balance(token, principal, subaccount)
          ),
        );

        subnetTokens.forEach((token, i) => {
          const balance = balances[i];
          results.set(token.canister_id, 
            typeof balance === 'bigint' ? balance : balance.default
          );
        });
      }),
    );

    return results;
  }

  public static async checkAndRequestIcrc2Allowances(
    token: FE.Token,
    payAmount: bigint,
  ): Promise<bigint | null> {
    if (!token?.canister_id) {
      throw new Error("Invalid token: missing canister_id");
    }
    ``;

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

  private static decodeAccountId(accountId: string): { owner: Principal, subaccount?: number[] } {
    try {
        // Add input validation
        if (!accountId || accountId.length !== 64) {
            throw new Error(`Invalid account ID length: ${accountId.length}`);
        }
        if (!/^[0-9a-fA-F]+$/.test(accountId)) {
            throw new Error("Invalid account ID format: not hex");
        }

        const accountIdBytes = this.hex2array(accountId);
        console.log("Account ID bytes:", accountIdBytes);

        // First 4 bytes are CRC32 checksum, skip them
        const principalBytes = accountIdBytes.slice(4, 28);  // Changed from 32 to 28
        const subaccountBytes = accountIdBytes.slice(28);    // Changed from 32 to 28

        console.log("Principal bytes:", principalBytes);
        console.log("Subaccount bytes:", subaccountBytes);

        // Convert bytes to Principal
        const principal = Principal.fromUint8Array(principalBytes);
        console.log("Decoded principal:", principal.toString());

        // If subaccount exists, return it
        return subaccountBytes.length > 0
            ? { owner: principal, subaccount: Array.from(subaccountBytes) }
            : { owner: principal };
    } catch (error) {
        console.error("Error decoding account ID:", error);
        throw new Error(`Invalid account ID format: ${error.message}`);
    }
  }

  private static hex2array(hex: string): Uint8Array {
    const pairs = hex.match(/[\dA-F]{2}/gi) || [];
    return new Uint8Array(pairs.map(s => parseInt(s, 16)));
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

            console.log("Ledger transfer args:", transfer_args);
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
