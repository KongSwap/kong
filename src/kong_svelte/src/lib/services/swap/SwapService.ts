// src/lib/services/swap/SwapService.ts
import { toastStore } from "$lib/stores/toastStore";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { swapStatusStore } from "$lib/stores/swapStore";
import { auth } from "$lib/stores/auth";
import { KONG_BACKEND_CANISTER_ID } from "$lib/constants/canisterConstants";
import { requireWalletConnection } from "$lib/stores/auth";
import { SwapMonitor } from "./SwapMonitor";
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { canisters, type CanisterType } from "$lib/config/auth.config";
import type { RequestsResult, SwapAmountsResult } from "../../../../../declarations/kong_backend/kong_backend.did.d.ts";
import { getTokenId, isKongToken, isSolanaToken, type AnyToken } from "$lib/utils/tokenUtils";

interface SwapExecuteParams {
  swapId: string;
  payToken: AnyToken;
  payAmount: string;
  receiveToken: AnyToken;
  receiveAmount: string;
  userMaxSlippage: number;
  backendPrincipal: Principal;
  lpFees: any[];
}

interface SwapStatus {
  status: string;
  pay_amount: bigint;
  pay_symbol: string;
  receive_amount: bigint;
  receive_symbol: string;
}

interface SwapResponse {
  Swap: SwapStatus;
}

interface RequestStatus {
  reply: SwapResponse;
  statuses: string[];
}

interface RequestResponse {
  Ok: RequestStatus[];
}

// Base BigNumber configuration for internal calculations
// Set this high enough to handle intermediate calculations without loss of precision
BigNumber.config({
  DECIMAL_PLACES: 36, // High enough for internal calculations
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-50, 50],
});

const BLOCKED_TOKEN_IDS = [];

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
    decimals?: number,
  ): bigint {
    try {
      // If decimals provided, handle scaling
      if (decimals !== undefined) {
        const multiplier = new BigNumber(10).pow(decimals);

        // If it's a BigNumber instance
        if (value instanceof BigNumber) {
          if (value.isNaN() || !value.isFinite()) {
            console.warn("Invalid BigNumber value:", value);
            return BigInt(0);
          }
          return BigInt(
            value
              .times(multiplier)
              .integerValue(BigNumber.ROUND_DOWN)
              .toString(),
          );
        }

        // If it's a string or number
        if (!this.isValidNumber(value)) {
          console.warn("Invalid numeric value:", value);
          return BigInt(0);
        }

        const bn = new BigNumber(value);
        if (bn.isNaN() || !bn.isFinite()) {
          console.warn("Invalid conversion to BigNumber:", value);
          return BigInt(0);
        }

        return BigInt(
          bn.times(multiplier).integerValue(BigNumber.ROUND_DOWN).toString(),
        );
      }

      // Original logic for when no decimals provided
      if (value instanceof BigNumber) {
        return BigInt(value.integerValue(BigNumber.ROUND_DOWN).toString());
      }

      if (!this.isValidNumber(value)) {
        return BigInt(0);
      }

      const bn = new BigNumber(value);
      return BigInt(bn.integerValue(BigNumber.ROUND_DOWN).toString());
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
   * Determines if this is a cross-chain swap
   */
  public static isCrossChainSwap(payToken: AnyToken, receiveToken: AnyToken): boolean {
    const payIsSolana = isSolanaToken(payToken);
    const receiveIsSolana = isSolanaToken(receiveToken);
    return payIsSolana !== receiveIsSolana;
  }

  /**
   * Gets swap quote from backend
   */
  public static async swap_amounts(
    payToken: AnyToken,
    payAmount: bigint,
    receiveToken: AnyToken,
  ): Promise<SwapAmountsResult> {
    try {
      const payTokenId = getTokenId(payToken);
      const receiveTokenId = getTokenId(receiveToken);
      
      if (!payTokenId || !receiveTokenId) {
        throw new Error("Invalid tokens provided for swap quote");
      }

      // Check if either token is a Solana token (cross-chain or Solana-to-Solana)
      if (isSolanaToken(payToken) || isSolanaToken(receiveToken)) {
        // Use CrossChainSwapService for any swap involving Solana tokens
        const { CrossChainSwapService } = await import('./CrossChainSwapService');
        const quote = await CrossChainSwapService.getQuote(payToken, payAmount, receiveToken);
        
        // Convert to SwapAmountsResult format
        return {
          Ok: {
            pay_amount: payAmount,
            receive_amount: quote.receiveAmount,
            pay_symbol: payToken.symbol,
            receive_symbol: receiveToken.symbol,
            lp_fee: [],
            gas_fee: [],
            swap_slippage: new BigNumber(0.5), // 0.5% slippage for cross-chain
            price_impact: new BigNumber(0.1), // 0.1% price impact estimate
            exchange_rate: [
              {
                rate: new BigNumber(quote.price),
                base: payToken.symbol,
                quote: receiveToken.symbol
              }
            ]
          }
        } as SwapAmountsResult;
      }

      // Regular IC <-> IC swap
      if (!isKongToken(payToken) || !isKongToken(receiveToken)) {
        throw new Error("Both tokens must be Kong tokens for regular swaps");
      }

      const actor = auth.pnp.getActor<CanisterType["KONG_BACKEND"]>({
        canisterId: KONG_BACKEND_CANISTER_ID,
        idl: canisters.kongBackend.idl,
        anon: true,
      });
      return await actor.swap_amounts(
        "IC." + payToken.address,
        payAmount,
        "IC." + receiveToken.address,
      );
    } catch (error) {
      console.error("Error getting swap amounts:", error);
      throw error;
    }
  }

  /**
   * Gets quote details including price, fees, etc.
   */
  public static async getQuoteDetails(params: {
    payToken: AnyToken;
    payAmount: bigint;
    receiveToken: AnyToken;
  }): Promise<{
    receiveAmount: string;
    price: string;
    usdValue: string;
    lpFee: String;
    gasFee: String;
    tokenFee?: String;
    slippage: number;
  }> {
    const quote = await SwapService.swap_amounts(
      params.payToken,
      params.payAmount,
      params.receiveToken,
    );

    if (!("Ok" in quote)) {
      throw new Error(quote.Err);
    }

    // For cross-chain swaps, we'll need different handling
    if (this.isCrossChainSwap(params.payToken, params.receiveToken)) {
      throw new Error("Cross-chain swap quotes not yet implemented");
    }

    // For regular IC swaps, both tokens must be Kong tokens
    if (!isKongToken(params.payToken) || !isKongToken(params.receiveToken)) {
      throw new Error("Both tokens must be Kong tokens for getQuoteDetails");
    }

    const tokens = await fetchTokensByCanisterId([params.payToken.address, params.receiveToken.address]);
    const receiveToken = tokens.find(
      (t) => t.address === params.receiveToken.address,
    );
    const payToken = tokens.find((t) => t.address === params.payToken.address);
    if (!receiveToken) throw new Error("Receive token not found");

    const receiveAmount = SwapService.fromBigInt(
      quote.Ok.receive_amount,
      receiveToken.decimals,
    );

    let lpFee = "0";
    let gasFee = "0";
    let tokenFee = "0";

    if (quote.Ok.txs.length > 0) {
      const tx = quote.Ok.txs[0];
      lpFee = SwapService.fromBigInt(tx.lp_fee, receiveToken.decimals);
      gasFee = SwapService.fromBigInt(tx.gas_fee, receiveToken.decimals);
      tokenFee = payToken.fee_fixed.toString();
    }

    return {
      receiveAmount,
      price: quote.Ok.price.toString(),
      usdValue: new BigNumber(receiveAmount).times(quote.Ok.price).toFormat(2),
      lpFee,
      gasFee,
      tokenFee,
      slippage: quote.Ok.slippage,
    };
  }

  /**
   * Executes swap asynchronously
   */
  public static async swap_async(params: {
    pay_token: string;
    pay_amount: bigint;
    receive_token: string;
    receive_amount: [] | [bigint];
    max_slippage: [] | [number];
    receive_address: [] | [string];
    referred_by: [] | [string];
    pay_tx_id: [] | [{ BlockIndex: bigint }];
  }): Promise<BE.SwapAsyncResponse> {
    try {
      console.log("swap_async", auth.pnp)
      const actor = auth.pnp.getActor<CanisterType["KONG_BACKEND"]>({
          canisterId: KONG_BACKEND_CANISTER_ID,
          idl: canisters.kongBackend.idl,
          anon: false,
          requiresSigning: auth.pnp.adapter.id === "plug",
        });
      const result = await actor.swap_async(params);
      return result;
    } catch (error) {
      console.error("Error in swap_async:", error);
      throw error;
    }
  }

  /**
   * Gets request status
   */
  public static async requests(requestIds: bigint[]): Promise<RequestsResult> {
    try {
      const actor = auth.pnp.getActor<CanisterType["KONG_BACKEND"]>({
        canisterId: KONG_BACKEND_CANISTER_ID,
        idl: canisters.kongBackend.idl,
        anon: true,
        requiresSigning: false,
      });
      // Ensure we only pass a single-element array or empty array
      const result = await actor.requests([requestIds[0]]);
      return result;
    } catch (error) {
      console.error("Error getting request status:", error);
      throw error;
    }
  }

  /**
   * Executes complete swap flow
   */
  public static async executeSwap(
    params: SwapExecuteParams,
  ): Promise<bigint | false> {
    const swapId = params.swapId;
    try {
      requireWalletConnection();
      // Add check for blocked tokens at the start
      if (BLOCKED_TOKEN_IDS.includes(params.payToken.address) || 
          BLOCKED_TOKEN_IDS.includes(params.receiveToken.address)) {
        toastStore.warning(
          "BIL token is currently in read-only mode. Trading will resume when the ledger is stable.",
          {
            title: "Token Temporarily Unavailable",
            duration: 8000
          }
        );
        swapStatusStore.updateSwap(swapId, {
          status: "Failed",
          isProcessing: false,
          error: "Token temporarily unavailable"
        });
        return false;
      }
      const payToken = params.payToken

      if (!payToken) {
        throw new Error(`Pay token ${params.payToken.symbol} not found`);
      }

      const payAmount = SwapService.toBigInt(
        params.payAmount,
        payToken.decimals,
      );

      const receiveToken = params.receiveToken

      if (!receiveToken) {
        throw new Error(`Receive token ${params.receiveToken.symbol} not found`);
      }

      let txId: bigint | false;
      let approvalId: bigint | false;
      const toastId = toastStore.info(
        `Swapping ${params.payAmount} ${params.payToken.symbol} to ${params.receiveAmount} ${params.receiveToken.symbol}...`,
        { duration: 15000 }, // 15 seconds
      );

      if (payToken.standards.includes("ICRC-2")) {
        const requiredAllowance = payAmount;
        approvalId = await IcrcService.checkAndRequestIcrc2Allowances(
          payToken,
          requiredAllowance,
        );
      } else if (payToken.standards.includes("ICRC-1")) {
        const result = await IcrcService.transfer(
          payToken,
          params.backendPrincipal,
          payAmount,
          { fee: BigInt(payToken.fee_fixed) },
        );

        if (result?.Ok) {
          txId = result.Ok;
        } else {
          txId = false;
        }
      } else {
        throw new Error(
          `Token ${payToken.symbol} does not support ICRC1 or ICRC2`,
        );
      }

      if (txId === false || approvalId === false) {
        swapStatusStore.updateSwap(swapId, {
          status: "Failed",
          isProcessing: false,
          error: "Transaction failed during transfer/approval",
        });
        toastStore.error("Transaction failed during transfer/approval");
        return false;
      }

      const swapParams = {
        pay_token: "IC." + params.payToken.address,
        pay_amount: BigInt(payAmount),
        receive_token: "IC." + params.receiveToken.address,
        receive_amount: [] as [] | [bigint],
        max_slippage: [params.userMaxSlippage] as [] | [number],
        receive_address: [] as [] | [string],
        referred_by: [] as [] | [string],
        pay_tx_id: txId ? [{ BlockIndex: BigInt(txId) }] as [] | [{ BlockIndex: bigint }] : [] as [] | [{ BlockIndex: bigint }],
      };

      const result = await SwapService.swap_async(swapParams);

      if (result.Ok) {
        SwapMonitor.monitorTransaction(result?.Ok, swapId, toastId);
      } else {
        console.log("auth.pnp", auth.pnp)
        console.error("Swap error:", result.Err);
        return false;
      }
      return result.Ok;
    } catch (error) {
      swapStatusStore.updateSwap(swapId, {
        status: "Failed",
        isProcessing: false,
        error: error instanceof Error ? error.message : "Swap failed",
      });
      console.error("Swap execution failed:", error);
      toastStore.error(error instanceof Error ? error.message : "Swap failed");
      return false;
    }
  }

  /**
   * Fetches the swap quote based on the provided amount and tokens.
   */
  public static async getSwapQuote(
    payToken: AnyToken,
    receiveToken: AnyToken,
    payAmount: string,
  ): Promise<{ receiveAmount: string; slippage: number }> {
    try {
      // Check if this is a cross-chain swap
      if (this.isCrossChainSwap(payToken, receiveToken)) {
        throw new Error("Cross-chain swaps should use CrossChainSwapService.getQuote");
      }

      // Type guard - ensure both tokens are Kong tokens for regular swaps
      if (!isKongToken(payToken) || !isKongToken(receiveToken)) {
        throw new Error("Both tokens must be Kong tokens for regular swaps");
      }

      // Add check for blocked tokens at the start
      if (BLOCKED_TOKEN_IDS.includes(payToken.address) || 
          BLOCKED_TOKEN_IDS.includes(receiveToken.address)) {
        throw new Error("Token temporarily unavailable - BIL is in read-only mode");
      }

      // Validate input amount
      if (!payAmount || isNaN(Number(payAmount))) {
        console.warn("Invalid pay amount:", payAmount);
        return {
          receiveAmount: "0",
          slippage: 0,
        };
      }

      // Convert amount to BigInt with proper decimal handling
      const payAmountBN = new BigNumber(payAmount);
      const payAmountInTokens = this.toBigInt(payAmountBN, payToken.decimals);

      const quote = await this.swap_amounts(
        payToken,
        payAmountInTokens,
        receiveToken,
      );

      if ("Ok" in quote) {
        // Get decimals synchronously from the token object
        const receiveDecimals = receiveToken.decimals;
        const receivedAmount = this.fromBigInt(
          quote.Ok.receive_amount,
          receiveDecimals,
        );

        return {
          receiveAmount: receivedAmount,
          slippage: quote.Ok.slippage,
        };
      } else if ("Err" in quote) {
        throw new Error(quote.Err);
      }

      throw new Error("Invalid quote response");
    } catch (err) {
      console.error("Error fetching swap quote:", err);
      throw err;
    }
  }

  /**
   * Calculates the maximum transferable amount of a token, considering fees.
   *
   * @param tokenInfo - Information about the token, including fees and canister ID.
   * @param formattedBalance - The user's available balance of the token as a string.
   * @param decimals - Number of decimal places the token supports.
   * @param isIcrc1 - Boolean indicating if the token follows the ICRC1 standard.
   * @returns A BigNumber representing the maximum transferable amount.
   */
  public static calculateMaxAmount(
    tokenInfo: AnyToken,
    formattedBalance: string,
    decimals: number = 8,
    isIcrc1: boolean = false,
  ): BigNumber {
    const SCALE_FACTOR = new BigNumber(10).pow(decimals);
    const balance = new BigNumber(formattedBalance);

    // For Solana tokens, we don't have fee_fixed property, so return balance as is
    if (isSolanaToken(tokenInfo)) {
      return balance;
    }

    // For Kong tokens, calculate fees
    // Calculate base fee. If fee is undefined, default to 0.
    const baseFee = tokenInfo.fee_fixed
      ? new BigNumber(tokenInfo.fee_fixed.toString()).dividedBy(SCALE_FACTOR)
      : new BigNumber(0);

    // Calculate gas fee based on token standard
    const gasFee = isIcrc1 ? baseFee : baseFee.multipliedBy(2);

    // Ensure that the max amount is not negative
    const maxAmount = balance.minus(gasFee);
    return BigNumber.maximum(maxAmount, new BigNumber(0));
  }
}
