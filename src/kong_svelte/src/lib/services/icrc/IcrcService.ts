import { auth, icpActor, icrcActor } from "$lib/stores/auth";
import { canisters, type CanisterType } from "$lib/config/auth.config";
import { Principal } from "@dfinity/principal";
import { toastStore } from "$lib/stores/toastStore";
import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
import { get } from "svelte/store";
import { type IcrcAccount } from "@dfinity/ledger-icrc";
import type { ApproveArgs } from "@dfinity/ledger-icrc/dist/candid/icrc_ledger";
import type { TransferArgs } from "@dfinity/ledger-icp/dist/candid/ledger";
import { hexStringToUint8Array } from "@dfinity/utils";

export class IcrcService {
  private static readonly MAX_CONCURRENT_REQUESTS = 5;

  private static async withConcurrencyLimit<T>(
    operations: (() => Promise<T>)[],
    limit: number = this.MAX_CONCURRENT_REQUESTS,
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
        console.error("Operation failed:", error);
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
    token: Kong.Token,
    principal: Principal,
    subaccount?: number[] | undefined,
    separateBalances: boolean = false,
  ): Promise<{ default: bigint; subaccount: bigint } | bigint> {
    try {
      const actor = icrcActor({
        canisterId: token.address,
        anon: true,
      });

      // Get default balance with retry logic
      const defaultBalance = await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [],
      });

      // If we don't need separate balances or there's no subaccount, return total
      if (!separateBalances || !subaccount) {
        return defaultBalance;
      }

      // Get subaccount balance with retry logic
      const subaccountBalance = await actor.icrc1_balance_of({
        owner: principal,
        subaccount: [subaccount],
      });

      return {
        default: defaultBalance,
        subaccount: subaccountBalance,
      };
    } catch (error) {
      console.error(`Error getting ICRC1 balance for ${token.symbol}:`, error);
      return separateBalances
        ? { default: BigInt(0), subaccount: BigInt(0) }
        : BigInt(0);
    }
  }

  public static async batchGetBalances(
    tokens: Kong.Token[],
    principal: string,
  ): Promise<Map<string, bigint>> {
    // Add request deduplication with a shorter window and token-specific keys
    const requestKeys = tokens.map(
      (token) =>
        `${token.address}-${principal}-${Date.now() - (Date.now() % 5000)}`,
    );

    // Check if any of these exact tokens are already being fetched
    const pendingPromises = requestKeys
      .map((key) => this.pendingRequests.get(key))
      .filter(Boolean);

    if (pendingPromises.length === tokens.length) {
      // All tokens are already being fetched, wait for them
      const results = await Promise.all(pendingPromises);
      return new Map([...results.flatMap((m) => [...m.entries()])]);
    }

    // Some or none of the tokens are being fetched, do a fresh fetch
    const promise = this._batchGetBalances(tokens, principal);

    // Store the promise for each token
    requestKeys.forEach((key) => {
      this.pendingRequests.set(key, promise);
      // Clean up after 5 seconds
      setTimeout(() => this.pendingRequests.delete(key), 250);
    });

    try {
      const result = await promise;
      return result;
    } catch (error) {
      console.error("Error in batchGetBalances:", error);
      requestKeys.forEach((key) => this.pendingRequests.delete(key));
      return new Map();
    }
  }

  // Add this as a static class property
  private static pendingRequests = new Map<
    string,
    Promise<Map<string, bigint>>
  >();

  private static async _batchGetBalances(
    tokens: Kong.Token[],
    principal: string,
  ): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();
    const subaccount = auth.pnp?.account?.subaccount
      ? Array.from(hexStringToUint8Array(auth.pnp.account.subaccount))
      : undefined;

    // Group tokens by subnet to minimize subnet key fetches
    const tokensBySubnet = tokens.reduce((acc, token) => {
      const subnet = token.address.split("-")[1];
      if (!acc.has(subnet)) acc.set(subnet, []);
      acc.get(subnet).push(token);
      return acc;
    }, new Map<string, Kong.Token[]>());

    // Process subnets in parallel with a higher concurrency limit
    const subnetEntries = Array.from(tokensBySubnet.entries());
    const subnetOperations = subnetEntries.map(
      ([subnet, subnetTokens]) =>
        async () => {
          const operations = subnetTokens.map((token) => async () => {
            try {
              const balance = await this.getIcrc1Balance(
                token,
                Principal.fromText(principal),
                subaccount,
              );
              return { token, balance };
            } catch (error) {
              console.error(
                `Failed to get balance for ${token.symbol}:`,
                error,
              );
              return { token, balance: BigInt(0) };
            }
          });

          // Increase concurrency limit for token balance fetching
          const balances = await this.withConcurrencyLimit(operations, 30);

          balances.forEach((result) => {
            if (result) {
              const { token, balance } = result;
              results.set(
                token.address,
                typeof balance === "bigint" ? balance : balance.default,
              );
            }
          });
        },
    );

    // Process all subnets with higher concurrency
    await this.withConcurrencyLimit(subnetOperations, 25);
    return results;
  }

  public static async checkAndRequestIcrc2Allowances(
    token: Kong.Token,
    payAmount: bigint,
    spender: string = KONG_BACKEND_CANISTER_ID,
  ): Promise<bigint | null> {
    if (!token?.address) {
      throw new Error("Invalid token: missing address");
    }

    try {
      const expiresAt =
        BigInt(Date.now() + 1000 * 60 * 60 * 24 * 29) * BigInt(1000000); // 29 days
      const authStore = get(auth);

      // Calculate total amount including fee
      const cleanFee = token.fee_fixed?.replace(/_/g, "");
      const tokenFee = cleanFee && /^\d+$/.test(cleanFee)
        ? BigInt(cleanFee)
        : 0n;
      const totalAmount = payAmount + (tokenFee * 4n);

      const allowanceActor = icrcActor({
        canisterId: token.address,
        anon: true,
      })

      // Check current allowance
      const currentAllowance = await allowanceActor.icrc2_allowance({
        account: {
          owner: Principal.fromText(authStore.account.owner),
          subaccount: [],
        },
        spender: { 
          owner: Principal.fromText(spender),
          subaccount: [],
        },
      })
      const isExpired = currentAllowance.expires_at.length > 0 && currentAllowance.expires_at[0] < BigInt(Date.now() * 1000);

      if (currentAllowance && !isExpired && currentAllowance.allowance > totalAmount) {
        return currentAllowance.allowance;
      }

      let approveAmount: bigint;
      if (token?.metrics?.total_supply) {
        const cleanSupply = token.metrics.total_supply.toString().replace(/_/g, "");
        approveAmount = /^\d+$/.test(cleanSupply)
          ? BigInt(cleanSupply)
          : totalAmount * 10n;
      } else {
        approveAmount = totalAmount * 10n;
      }

      const approveArgs: ApproveArgs = {
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: approveAmount,
        expected_allowance: [],
        expires_at: [expiresAt],
        spender: {
          owner: Principal.fromText(spender),
          subaccount: [],
        },
      };

      const approveActor = icrcActor({
        canisterId: token.address,
        anon: false,
        requiresSigning: true,
      })

      const result = await approveActor.icrc2_approve(approveArgs);

      if ("Err" in result) {
        // Convert BigInt values to strings in the error object
        const stringifiedError = JSON.stringify(result.Err, (_, value) =>
          typeof value === "bigint" ? value.toString() : value,
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

  public static async getTokenFee(token: Kong.Token): Promise<bigint> {
    try {
      const actor = icrcActor({
        canisterId: token.address,
        anon: true
      });
      return await actor.icrc1_fee();
    } catch (error) {
      console.error(`Error getting token fee for ${token.symbol}:`, error);
      return BigInt(10000); // Fallback to default fee
    }
  }

  public static async transfer(
    token: Kong.Token,
    to: string | Principal | IcrcAccount,
    amount: bigint,
    opts: {
      memo?: Uint8Array | number[];
      fee?: bigint;
      fromSubaccount?: Uint8Array | number[];
      createdAtTime?: bigint;
    } = {},
  ): Promise<any> {
    try {
      // If it's an ICP transfer to a legacy Account ID string
      if (
        token.symbol === "ICP" &&
        typeof to === "string" &&
        to.length === 64 &&
        !to.includes("-")
      ) {
        const wallet = auth.pnp.adapter.id;
        if (wallet === "oisy") {
          return { Err: "Oisy subaccount transfer is temporarily disabled." };
        }
        const ledgerActor = icpActor({requiresSigning: true});

        const transfer_args: TransferArgs = {
          to: this.hex2Bytes(to),
          amount: { e8s: amount },
          fee: { e8s: opts.fee ?? BigInt(token.fee_fixed ?? 10000) },
          memo: 0n,
          from_subaccount: opts.fromSubaccount
            ? [Array.from(opts.fromSubaccount)]
            : [],
          created_at_time: opts.createdAtTime
            ? [{ timestamp_nanos: opts.createdAtTime }]
            : [],
        };

        const result = await ledgerActor.transfer(transfer_args);
        if ("Err" in result) {
          const stringifiedError = JSON.stringify(result.Err, (_, value) =>
            typeof value === "bigint" ? value.toString() : value,
          );
          return { Err: JSON.parse(stringifiedError) };
        }
        return { Ok: BigInt(result.Ok) };
      }

      // For all ICRC standard transfers (Principal or ICRC1 Account)
      const actor = icrcActor({
        canisterId: token.address,
        anon: false,
        requiresSigning: true,
      });

      let recipientAccount: {
        owner: Principal;
        subaccount: [] | [Uint8Array | number[]];
      };

      if (typeof to === "string") {
        recipientAccount = {
          owner: Principal.fromText(to),
          subaccount: [],
        };
      } else if (to instanceof Principal) {
        recipientAccount = { owner: to, subaccount: [] };
      } else {
        recipientAccount = {
          owner: to.owner,
          subaccount: to.subaccount ? [to.subaccount] : [],
        };
      }

      const transferFee = opts.fee ?? (await this.getTokenFee(token));

      const result = await actor.icrc1_transfer({
        to: recipientAccount,
        amount,
        fee: [transferFee],
        memo: opts.memo ? [opts.memo] : [],
        from_subaccount: opts.fromSubaccount ? [opts.fromSubaccount] : [],
        created_at_time: opts.createdAtTime ? [opts.createdAtTime] : [],
      });
      return result;
    } catch (error) {
      console.error("Transfer error:", error);
      const stringifiedError = JSON.stringify(error, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      return { Err: JSON.parse(stringifiedError) };
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
