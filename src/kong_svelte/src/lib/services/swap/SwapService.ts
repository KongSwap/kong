// src/lib/services/swap/SwapService.ts
// Consolidated swap service merging SwapService, SwapLogicService, and SwapMonitor

import { toastStore } from "$lib/stores/toastStore";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { swapStatusStore } from "$lib/stores/swapStore";
import { auth, swapActor } from "$lib/stores/auth";
import { requireWalletConnection } from "$lib/stores/auth";
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { get } from "svelte/store";
import { loadBalances } from "$lib/stores/tokenStore";
import { userTokens } from "$lib/stores/userTokens";
import { trackEvent, AnalyticsEvent } from "$lib/utils/analytics";
import { swapState } from "$lib/stores/swapStateStore";
import type { SwapAmountsResult, RequestsResult } from "../../../../../declarations/kong_backend/kong_backend.did";

interface SwapExecuteParams {
  swapId: string;
  payToken: Kong.Token;
  payAmount: string;
  receiveToken: Kong.Token;
  receiveAmount: string;
  userMaxSlippage: number;
  backendPrincipal: Principal;
  lpFees: any[];
}

// These types match the backend response structure
interface SwapStatus {
  status: string;
  pay_amount: bigint;
  pay_symbol: string;
  receive_amount: bigint;
  receive_symbol: string;
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
  // Transaction monitoring state
  private static FAST_POLLING_INTERVAL = 100; // 100ms polling interval
  private static MAX_ATTEMPTS = 200; // 30 seconds total monitoring time
  private static pollingInterval: NodeJS.Timeout | null = null;
  private static startTime: number;

  // === Utility Methods ===
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
   * Calculates the maximum transferable amount of a token, considering fees.
   *
   * @param tokenInfo - Information about the token, including fees and canister ID.
   * @param formattedBalance - The user's available balance of the token as a string.
   * @param decimals - Number of decimal places the token supports.
   * @param isIcrc1 - Boolean indicating if the token follows the ICRC1 standard.
   * @returns A BigNumber representing the maximum transferable amount.
   */
  public static calculateMaxAmount(
    tokenInfo: Kong.Token,
    formattedBalance: string,
    decimals: number = 8,
    isIcrc1: boolean = false,
  ): BigNumber {
    const SCALE_FACTOR = new BigNumber(10).pow(decimals);
    const balance = new BigNumber(formattedBalance);

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

  // === Quote Methods ===
  /**
   * Gets swap quote from backend
   */
  public static async swap_amounts(
    payToken: Kong.Token,
    payAmount: bigint,
    receiveToken: Kong.Token,
  ): Promise<SwapAmountsResult> {
    try {
      if (!payToken?.address || !receiveToken?.address) {
        throw new Error("Invalid tokens provided for swap quote");
      }
      const actor = swapActor({anon: true, requiresSigning: false});
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
    payToken: Kong.Token;
    payAmount: bigint;
    receiveToken: Kong.Token;
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
   * Fetches the swap quote based on the provided amount and tokens.
   */
  public static async getSwapQuote(
    payToken: Kong.Token,
    receiveToken: Kong.Token,
    payAmount: string,
  ): Promise<{ 
    receiveAmount: string; 
    slippage: number;
    gasFees: Array<{ amount: string; token: string }>;
    lpFees: Array<{ amount: string; token: string }>;
    routingPath: Array<{
      paySymbol: string;
      receiveSymbol: string;
      poolSymbol: string;
      payAmount: string;
      receiveAmount: string;
      price: number;
    }>;
  }> {
    try {
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
          gasFees: [],
          lpFees: [],
          routingPath: [],
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

        // Extract fees from the quote
        const gasFees: Array<{ amount: string; token: string }> = [];
        const lpFees: Array<{ amount: string; token: string }> = [];
        const routingPath: Array<{
          paySymbol: string;
          receiveSymbol: string;
          poolSymbol: string;
          payAmount: string;
          receiveAmount: string;
          price: number;
        }> = [];

        if (quote.Ok.txs && quote.Ok.txs.length > 0) {
          for (const tx of quote.Ok.txs) {
            // Extract canister ID from receive_address (remove "IC." prefix if present)
            const feeTokenId = tx.receive_address.startsWith("IC.") 
              ? tx.receive_address.substring(3) 
              : tx.receive_address;
            
            // Determine token decimals for the fee
            // For multi-hop swaps, we need to look up each intermediate token's decimals
            let feeTokenDecimals = 8; // Default to 8 decimals
            let payTokenDecimals = 8; // Default to 8 decimals for pay token in this hop
            
            // Special case for ICP
            if (tx.receive_symbol === "ICP") {
              feeTokenDecimals = 8;
            } else if (feeTokenId === receiveToken.address) {
              // If it's the final receive token, use its decimals
              feeTokenDecimals = receiveDecimals;
            } else if (feeTokenId === payToken.address) {
              // If it's the pay token, use its decimals
              feeTokenDecimals = payToken.decimals;
            } else {
              // For intermediate tokens in multi-hop swaps, we need to look them up
              // For now, we'll use a default of 8 decimals for unknown tokens
              // This could be improved by fetching token details from the store
              feeTokenDecimals = 8;
            }
            
            // Similar logic for pay token decimals
            const payTokenId = tx.pay_address.startsWith("IC.") 
              ? tx.pay_address.substring(3) 
              : tx.pay_address;
            if (tx.pay_symbol === "ICP") {
              payTokenDecimals = 8;
            } else if (payTokenId === payToken.address) {
              payTokenDecimals = payToken.decimals;
            } else if (payTokenId === receiveToken.address) {
              payTokenDecimals = receiveToken.decimals;
            }
            
            // Add to routing path
            routingPath.push({
              paySymbol: tx.pay_symbol,
              receiveSymbol: tx.receive_symbol,
              poolSymbol: tx.pool_symbol,
              payAmount: this.fromBigInt(tx.pay_amount, payTokenDecimals),
              receiveAmount: this.fromBigInt(tx.receive_amount, feeTokenDecimals),
              price: tx.price,
            });
            
            // Add gas fee
            if (tx.gas_fee) {
              gasFees.push({
                amount: this.fromBigInt(tx.gas_fee, feeTokenDecimals),
                token: feeTokenId, // Use canister ID instead of symbol
              });
            }
            
            // Add LP fee
            if (tx.lp_fee) {
              lpFees.push({
                amount: this.fromBigInt(tx.lp_fee, feeTokenDecimals),
                token: feeTokenId, // Use canister ID instead of symbol
              });
            }
          }
        }

        return {
          receiveAmount: receivedAmount,
          slippage: quote.Ok.slippage,
          gasFees,
          lpFees,
          routingPath,
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

  // === Token Selection Logic (from SwapLogicService) ===
  static handleSelectToken(type: "pay" | "receive", token: Kong.Token) {
    const state = get(swapState);
    
    if (
      (type === "pay" && token?.address === state.receiveToken?.address) ||
      (type === "receive" && token?.address === state.payToken?.address)
    ) {
      toastStore.error("Cannot select the same token for both sides");
      return;
    }

    const updates: Partial<typeof state> = {
      manuallySelectedTokens: {
        ...state.manuallySelectedTokens,
        [type]: true
      }
    };

    if (type === "pay") {
      updates.payToken = token;
      updates.showPayTokenSelector = false;
    } else {
      updates.receiveToken = token;
      updates.showReceiveTokenSelector = false;
    }

    swapState.update(state => ({ ...state, ...updates }));
  }

  static async handleSwapSuccess(event: CustomEvent) {
    const tokens = get(userTokens).tokens;
    if (!tokens?.length) {
      console.warn('TokenStore not initialized or empty');
      return;
    }

    const payToken = tokens.find((t: any) => t.symbol === event.detail.payToken);
    const receiveToken = tokens.find((t: any) => t.symbol === event.detail.receiveToken);

    if (!payToken || !receiveToken) {
      console.error('Could not find pay or receive token', {
        paySymbol: event.detail.payToken,
        receiveSymbol: event.detail.receiveToken,
        availableTokens: tokens.map(t => t.symbol)
      });
      return;
    }

    // Reset the swap state
    swapState.update((state) => ({
      ...state,
      payAmount: "",
      receiveAmount: "",
      error: null,
      isProcessing: false,
    }));
  }

  // === Swap Execution Methods ===
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
      const actor = swapActor({anon: false, requiresSigning: auth.pnp.adapter.id === "plug"});
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
      const actor = swapActor({anon: true, requiresSigning: false});
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
        // Start monitoring the transaction
        this.monitorTransaction(result?.Ok, swapId, toastId);
      } else {
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

  // === Transaction Monitoring (from SwapMonitor) ===
  private static async monitorTransaction(requestId: bigint, swapId: string, toastId: string) {
    this.stopPolling();
    this.startTime = Date.now();
    let attempts = 0;
    let shownStatuses = new Set<string>();

    const poll = async () => {
      if (attempts >= this.MAX_ATTEMPTS) {
        this.stopPolling();
        swapStatusStore.updateSwap(swapId, {
          status: "Timeout",
          isProcessing: false,
          error: "Swap timed out",
        });
        toastStore.error("Swap timed out");
        return;
      }

      try {
        const status = await SwapService.requests([requestId]);

        if ("Ok" in status) {
          const res = status.Ok[0];

          // Only show toast for new status updates
          if (res.statuses && res.statuses.length > 0) {            
            for (const status of res.statuses) {
              if (!shownStatuses.has(status)) {
                shownStatuses.add(status);
                
                if (status.toLowerCase() === "swap success") {
                  toastStore.dismiss(toastId);
                  toastStore.info(`Swap completed`);
                  swapState.setShowSuccessModal(true);
                } else if (status === "Success") {
                  toastStore.info(`Balances updated!`);
                } else if (status.toLowerCase().includes("failed")) {
                  toastStore.dismiss(toastId);
                  toastStore.error(`${status}`);
                }
              }
            }
          }

          if (res.statuses.find((s) => s.includes("Failed"))) {
            this.stopPolling();
            swapStatusStore.updateSwap(swapId, {
              status: "Error",
              isProcessing: false,
              error: res.statuses.find((s) => s.includes("Failed")),
            });
            toastStore.dismiss(toastId);
            toastStore.error(res.statuses.find((s) => s.includes("Failed")));
            return;
          }

          if ("Swap" in res.reply) {
            const swapStatus = res.reply.Swap as SwapStatus;
            swapStatusStore.updateSwap(swapId, {
              status: swapStatus.status,
              isProcessing: true,
              error: null,
            });

            if (swapStatus.status === "Success") {
              this.stopPolling();
              const token0 = get(userTokens).tokens.find(
                (t) => t.symbol === swapStatus.pay_symbol,
              );
              const token1 = get(userTokens).tokens.find(
                (t) => t.symbol === swapStatus.receive_symbol,
              );

              const formattedPayAmount = SwapService.fromBigInt(
                swapStatus.pay_amount,
                token0?.decimals || 0,
              );
              const formattedReceiveAmount = SwapService.fromBigInt(
                swapStatus.receive_amount,
                token1?.decimals || 0,
              );

              // Show detailed toast with actual amounts
              toastStore.success(`Swap of ${formattedPayAmount} ${swapStatus.pay_symbol} for ${formattedReceiveAmount} ${swapStatus.receive_symbol} completed successfully`);

              // Track successful swap event
              trackEvent(AnalyticsEvent.SwapCompleted, {
                pay_token: token0?.symbol,
                pay_amount: formattedPayAmount,
                receive_token: token1?.symbol,
                receive_amount: formattedReceiveAmount,
                duration_ms: Date.now() - this.startTime
              });

              swapStatusStore.updateSwap(swapId, {
                status: "Success",
                isProcessing: false,
                shouldRefreshQuote: true,
                lastQuote: null,
                details: {
                  payAmount: formattedPayAmount,
                  payToken: token0,
                  receiveAmount: formattedReceiveAmount,
                  receiveToken: token1,
                },
              });

              // Load updated balances
              const tokens = get(userTokens).tokens;
              const payToken = tokens.find(
                (t) => t.symbol === swapStatus.pay_symbol,
              );
              const receiveToken = tokens.find(
                (t) => t.symbol === swapStatus.receive_symbol,
              );
              const walletId = auth?.pnp?.account?.owner;

              if (!payToken || !receiveToken || !walletId) {
                console.error("Missing token or wallet info for balance update");
                return;
              }

              try {
                await loadBalances(
                  [payToken, receiveToken],
                  walletId,
                  true
                );
              } catch (error) {
                console.error("Error updating balances:", error);
              }

              return;
            } else if (swapStatus.status === "Failed") {
              this.stopPolling();
              swapStatusStore.updateSwap(swapId, {
                status: "Failed",
                isProcessing: false,
                error: "Swap failed",
              });
              toastStore.error("Swap failed");
              
              // Track failed swap event
              trackEvent(AnalyticsEvent.SwapFailed, {
                pay_token: swapStatus.pay_symbol,
                receive_token: swapStatus.receive_symbol,
                error: "Swap failed",
                duration_ms: Date.now() - this.startTime
              });
              
              return;
            }
          }
        }

        attempts++;
        this.pollingInterval = setTimeout(poll, this.FAST_POLLING_INTERVAL);
      } catch (error) {
        console.error("Error monitoring swap:", error);
        this.stopPolling();
        swapStatusStore.updateSwap(swapId, {
          status: "Error",
          isProcessing: false,
          error: "Failed to monitor swap status",
        });
        toastStore.error("Failed to monitor swap status");
        return;
      }
    };

    // Start polling
    poll();
  }

  private static stopPolling() {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Clean up method to be called when component unmounts
  public static cleanup() {
    this.stopPolling();
  }
}