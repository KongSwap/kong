// src/lib/services/SwapService.ts
import BigNumber from "bignumber.js";
import { auth, getKongActor, getKongBackendActor } from "./auth";
import { KONG_BACKEND_CANISTER_ID } from "./auth";
import { Principal } from "@dfinity/principal";
import { getWalletIdentity } from "../utils/wallet";

// Define types to match Candid interface
type OptionalBigInt = [] | [bigint];
type OptionalNumber = [] | [number];
type OptionalString = [] | [string];
type OptionalMemo = [] | [Uint8Array | number[]];
type OptionalSubaccount = [] | [Uint8Array | number[]];

// Define TxId variant type
type TxId = { TransactionId: string } | { BlockIndex: bigint };
type OptionalTxId = [] | [TxId];

// Configure BigNumber for calculations
BigNumber.config({
  DECIMAL_PLACES: 36,
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-50, 50],
});

export class SwapService {
  private static isValidNumber(value: string | number): boolean {
    if (typeof value === "number") {
      return !isNaN(value) && isFinite(value);
    }
    if (typeof value === "string") {
      const num = Number(value);
      return !isNaN(num) && isFinite(num);
    }
    return false;
  }

  public static toBigInt(
    value: string | number | BigNumber,
    decimals: number,
  ): bigint {
    try {
      const multiplier = new BigNumber(10).pow(decimals);
      
      if (value instanceof BigNumber) {
        if (value.isNaN() || !value.isFinite()) {
          return BigInt(0);
        }
        return BigInt(
          value
            .times(multiplier)
            .integerValue(BigNumber.ROUND_DOWN)
            .toString(),
        );
      }

      if (!this.isValidNumber(value)) {
        return BigInt(0);
      }

      const bn = new BigNumber(value);
      return BigInt(
        bn.times(multiplier).integerValue(BigNumber.ROUND_DOWN).toString(),
      );
    } catch (error) {
      console.error("Error converting to BigInt:", error);
      return BigInt(0);
    }
  }

  public static fromBigInt(amount: bigint, decimals: number): string {
    try {
      const result = new BigNumber(amount.toString())
        .div(new BigNumber(10).pow(decimals))
        .toString();
      return isNaN(Number(result)) ? "0" : result;
    } catch {
      return "0";
    }
  }

  /**
   * Gets swap quote from backend for KONG to ICP swap
   */
  public static async getKongToIcpQuote(
    kongAmount: bigint,
    kongDecimals: number,
    icpDecimals: number,
  ): Promise<{ receiveAmount: string; slippage: number }> {
    try {
      const actor = await getKongBackendActor({ anonymous: true });
      
      const quote = await actor.swap_amounts(
        "KONG",
        kongAmount,
        "ICP",
      );

      if ("Ok" in quote) {
        return {
          receiveAmount: this.fromBigInt(quote.Ok.receive_amount, icpDecimals),
          slippage: quote.Ok.slippage,
        };
      }

      throw new Error(quote.Err || "Failed to get swap quote");
    } catch (error) {
      console.error("Error getting KONG/ICP quote:", error);
      throw error;
    }
  }

  /**
   * Executes KONG to ICP swap with proper approval
   */
  public static async swapKongToIcp(
    kongAmount: bigint,
    maxSlippage: number = 2.0,
  ): Promise<bigint> {
    try {
      console.log('[SwapService][swapKongToIcp] Starting swap with params:', {
        kongAmount: kongAmount.toString(),
        maxSlippage
      });

      // Get current identity directly from PNP
      let identity;
      console.log('[SwapService][swapKongToIcp] Getting identity from PNP...');
      
      // Check if wallet is connected
      if (!auth.pnp?.isWalletConnected()) {
        throw new Error('Wallet not connected');
      }

      try {
        identity = getWalletIdentity(auth.pnp);
        if (!identity) {
          throw new Error('No identity found from wallet');
        }
        console.log('[SwapService][swapKongToIcp] Got identity:', {
          isAnonymous: identity.getPrincipal().isAnonymous(),
          principal: identity.getPrincipal().toText()
        });
      } catch (error) {
        console.error('[SwapService][swapKongToIcp] Error getting identity:', error);
        throw new Error('Failed to get identity from wallet');
      }

      if (!identity) {
        console.error('[SwapService][swapKongToIcp] No identity found');
        throw new Error('No identity found - user may not be authenticated');
      }

      console.log('[SwapService][swapKongToIcp] Current identity:', {
        principal: identity.getPrincipal().toString(),
        isAnonymous: identity.getPrincipal().isAnonymous()
      });

      // First get Kong actor to approve the swap
      console.log('[SwapService][swapKongToIcp] Getting Kong actor...');
      const kongActor = await getKongActor({ requiresSigning: true, anonymous: false });
      
      // Get name using anonymous actor for read operations
      const anonKongActor = await getKongActor({ anonymous: true });
      console.log('[SwapService][swapKongToIcp] Kong actor obtained with identity:', {
        actor: kongActor,
        actorPrincipal: await anonKongActor.icrc1_name(),
      });

      // Check KONG balance before approval
      try {
        const balance = await anonKongActor.icrc1_balance_of({
          owner: identity.getPrincipal(),
          subaccount: []
        });
        console.log('[SwapService][swapKongToIcp] Current KONG balance:', {
          balance: balance.toString(),
          requiredAmount: kongAmount.toString()
        });
      } catch (balanceError) {
        console.error('[SwapService][swapKongToIcp] Failed to fetch KONG balance:', balanceError);
      }

      console.log('[SwapService][swapKongToIcp] Getting backend actor...');
      const backendActor = await getKongBackendActor({ requiresSigning: true });
      console.log('[SwapService][swapKongToIcp] Backend actor obtained:', {
        actor: backendActor,
        methods: Object.keys(backendActor)
      });
      
      // Get backend principal directly from canister ID
      console.log('[SwapService][swapKongToIcp] Creating backend principal from:', KONG_BACKEND_CANISTER_ID);
      const backendPrincipal = Principal.fromText(KONG_BACKEND_CANISTER_ID);
      console.log('[SwapService][swapKongToIcp] Backend principal created:', backendPrincipal.toString());
      
      // Add 10% buffer to approval amount
      const approveAmount = kongAmount * BigInt(110) / BigInt(100);
      console.log('[SwapService][swapKongToIcp] Calculated approval amount:', {
        original: kongAmount.toString(),
        withBuffer: approveAmount.toString(),
        bufferPercent: '10%'
      });
      
      // Check current allowance before approval
      try {
        const currentAllowance = await anonKongActor.icrc2_allowance({
          account: {
            owner: identity.getPrincipal(),
            subaccount: []
          },
          spender: {
            owner: backendPrincipal,
            subaccount: []
          }
        });
        console.log('[SwapService][swapKongToIcp] Current allowance:', currentAllowance);
      } catch (allowanceError) {
        console.error('[SwapService][swapKongToIcp] Failed to fetch current allowance:', allowanceError);
      }
      
      // Approve Kong backend to spend tokens
      const approveArgs = {
        spender: {
          owner: backendPrincipal,
          subaccount: [] as OptionalSubaccount,
        },
        amount: approveAmount,
        fee: [BigInt(10000)] as OptionalBigInt,
        memo: [] as OptionalMemo,
        from_subaccount: [] as OptionalSubaccount,
        created_at_time: [] as OptionalBigInt,
        expected_allowance: [] as OptionalBigInt,
        expires_at: [] as OptionalBigInt,
      };

      console.log('[SwapService][swapKongToIcp] Constructed approve args:', JSON.stringify(approveArgs, (_, v) => 
        typeof v === 'bigint' ? v.toString() : v
      ));

      console.log('[SwapService][swapKongToIcp] Calling icrc2_approve...');
      const approveResult = await kongActor.icrc2_approve(approveArgs);
      console.log('[SwapService][swapKongToIcp] Approve result:', approveResult);

      if ("Err" in approveResult) {
        console.error('[SwapService][swapKongToIcp] Approval failed:', {
          error: approveResult.Err,
          args: approveArgs,
          identity: identity?.getPrincipal().toString(),
          backendPrincipal: backendPrincipal.toString()
        });
        throw new Error(typeof approveResult.Err === 'string' ? approveResult.Err : 'Failed to approve Kong backend');
      }

      console.log('[SwapService][swapKongToIcp] Approval successful, constructing swap args...');

      // Execute the swap
      const swapArgs = {
        pay_token: "KONG",
        pay_amount: kongAmount,
        receive_token: "ICP",
        receive_amount: [] as OptionalBigInt,
        max_slippage: [maxSlippage] as OptionalNumber,
        receive_address: [] as OptionalString,
        referred_by: [] as OptionalString,
        pay_tx_id: [] as OptionalTxId,
      };

      console.log('[SwapService][swapKongToIcp] Swap args:', JSON.stringify(swapArgs, (_, v) => 
        typeof v === 'bigint' ? v.toString() : v
      ));

      console.log('[SwapService][swapKongToIcp] Executing swap...');
      const result = await backendActor.swap(swapArgs);
      console.log('[SwapService][swapKongToIcp] Swap result:', result);

      if ("Ok" in result) {
        console.log('[SwapService][swapKongToIcp] Swap successful, receive amount:', result.Ok.receive_amount.toString());
        return result.Ok.receive_amount;
      }

      console.error('[SwapService][swapKongToIcp] Swap failed:', result.Err);
      throw new Error(typeof result.Err === 'string' ? result.Err : 'Swap failed');
    } catch (error: unknown) {
      console.error("[SwapService][swapKongToIcp] Error executing KONG/ICP swap:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error?.constructor?.name
      });
      throw error;
    }
  }
}
