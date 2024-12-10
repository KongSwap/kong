// src/lib/services/swap/SwapService.ts
import { tokenStore, getTokenDecimals } from "$lib/services/tokens/tokenStore";
import { toastStore } from "$lib/stores/toastStore";
import { get } from "svelte/store";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { swapStatusStore } from "./swapStore";
import { auth, canisterIDLs } from "$lib/services/auth";
import { formatTokenAmount } from "$lib/utils/numberFormatUtils";
import { canisterId as kongBackendCanisterId } from "../../../../../declarations/kong_backend";
import { requireWalletConnection } from "$lib/services/auth";

interface SwapExecuteParams {
  swapId: string;
  payToken: FE.Token;
  payAmount: string;
  receiveToken: FE.Token;
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

interface TokenInfo {
  canister_id: string;
  fee?: bigint;
  fee_fixed: bigint;
  icrc1?: boolean;
  icrc2?: boolean;
}

// Base BigNumber configuration for internal calculations
// Set this high enough to handle intermediate calculations without loss of precision
BigNumber.config({
  DECIMAL_PLACES: 36, // High enough for internal calculations
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: [-50, 50],
});

export class SwapService {
  private static pollingInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly POLLING_INTERVAL = 300; // .3 second
  private static readonly MAX_ATTEMPTS = 100; // 30 seconds

  public static toBigInt(amount: string, decimals: number): bigint {
    if (!amount || isNaN(Number(amount.replace(/_/g, '')))) return BigInt(0);
    return BigInt(
      new BigNumber(amount.replace(/_/g, '')).times(new BigNumber(10).pow(decimals)).toString(),
    );
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
   * Gets swap quote from backend
   */
  public static async swap_amounts(
    payToken: FE.Token,
    payAmount: bigint,
    receiveToken: FE.Token,
  ): Promise<BE.SwapQuoteResponse> {
    try {
      if (!payToken?.symbol || !receiveToken?.symbol) {
        throw new Error("Invalid tokens provided for swap quote");
      }
      const actor = await auth.getActor(
        kongBackendCanisterId,
        canisterIDLs.kong_backend,
        { anon: true },
      );
      return await actor.swap_amounts(
        payToken.symbol,
        payAmount,
        receiveToken.symbol,
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
    payToken: FE.Token;
    payAmount: bigint;
    receiveToken: FE.Token;
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

    const tokens = get(tokenStore).tokens;
    const receiveToken = tokens.find(
      (t) => t.address === params.receiveToken.address,
    );
    const payToken = tokens.find(
      (t) => t.address === params.payToken.address,
    );
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
    receive_amount: bigint[];
    max_slippage: number[];
    receive_address?: string[];
    referred_by?: string[];
    pay_tx_id?: { BlockIndex: number }[];
  }): Promise<BE.SwapAsyncResponse> {
    try {
      const actor = await auth.pnp.getActor(
        kongBackendCanisterId,
        canisterIDLs.kong_backend,
        { anon: false, requiresSigning: false },
      );
      console.log("SWAP_ASYNC ACTOR", actor);
      const result = await actor.swap_async(params);
      console.log("SWAP_ASYNC RESULT", result);
      return result;
    } catch (error) {
      console.error("Error in swap_async:", error);
      throw error;
    }
  }

  /**
   * Gets request status
   */
  public static async requests(requestIds: bigint[]): Promise<RequestResponse> {
    try {
      const actor = await auth.pnp.getActor(
        kongBackendCanisterId,
        canisterIDLs.kong_backend,
        { anon: false, requiresSigning: false },
      );
      console.log("REQUESTS ACTOR", actor);
      console.log("REQUESTS REQUEST IDS", requestIds);
      const result = await actor.requests(requestIds);
      console.log("REQUESTS RESULT", result);
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
      await Promise.all([
        requireWalletConnection(),
      ]);
      const tokens = get(tokenStore).tokens;
      const payToken = tokens.find(
        (t) => t.address === params.payToken.address,
      );
      if (!payToken) throw new Error("Pay token not found");

      const payAmount = SwapService.toBigInt(
        params.payAmount,
        payToken.decimals,
      );
      const receiveToken = tokens.find(
        (t) => t.address === params.receiveToken.address,
      );
      if (!receiveToken) throw new Error("Receive token not found");

      const receiveAmount = SwapService.toBigInt(
        params.receiveAmount,
        receiveToken.decimals,
      );

      console.log(
        "Processing transfer/approval for amount:",
        payAmount.toString(),
      );

      let txId: bigint | false;
      let approvalId: bigint | false;
      const toastId = toastStore.info(
        `Swapping ${params.payAmount} ${params.payToken.symbol} to ${params.receiveAmount} ${params.receiveToken.symbol}...`,
        0,
      );
      if (payToken.icrc2) {
        const requiredAllowance = payAmount;
        console.log("CHECKING AND REQUESTING IC2 ALLOWANCES, REQUIRED ALLOWANCE", requiredAllowance);
        approvalId = await IcrcService.checkAndRequestIcrc2Allowances(
          payToken,
          requiredAllowance,
        );
      } else if (payToken.icrc1) {
        console.log("ICRC1 PAY TOKEN DETECTED", payToken);
        const result = await IcrcService.icrc1Transfer(
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
        toastStore.dismiss(toastId);
        return false;
      }

      const swapParams = {
        pay_token: params.payToken.symbol,
        pay_amount: BigInt(payAmount),
        receive_token: params.receiveToken.symbol,
        receive_amount: [BigInt(receiveAmount)],
        max_slippage: [params.userMaxSlippage],
        receive_address: [],
        referred_by: [],
        pay_tx_id: txId ? [{ BlockIndex: Number(txId) }] : [],
      };

      console.log("SWAP PARAMS", swapParams);
      const result = await SwapService.swap_async(swapParams);

      if (result.Ok) {
        this.monitorTransaction(result?.Ok, swapId);
        toastStore.dismiss(toastId);
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

  public static async monitorTransaction(requestId: bigint, swapId: string) {
    this.stopPolling();

    console.log("SWAP MONITORING - REQUEST ID:", requestId);
    let attempts = 0;
    let swapStatus = swapStatusStore.getSwap(swapId);
    const toastId = toastStore.info(
      `Confirming swap of ${swapStatus?.payToken.symbol} to ${swapStatus?.receiveToken.symbol}...`,
      10000,
    );

    this.pollingInterval = setInterval(async () => {
      if (attempts >= this.MAX_ATTEMPTS) {
        this.stopPolling();
        swapStatusStore.updateSwap(swapId, {
          status: "Timeout",
          isProcessing: false,
          error: "Swap timed out",
        });
        toastStore.error("Swap timed out");
        toastStore.dismiss(toastId);
        return;
      }

      console.log(`SWAP MONITORING - POLLING ATTEMPT ${attempts}`);
      try {
        const status: RequestResponse = await this.requests([requestId]);

        if (status.Ok?.[0]?.reply) {
          const res: RequestStatus = status.Ok[0];

          if (res.statuses.find((s) => s.includes("Failed"))) {
            this.stopPolling();
            swapStatusStore.updateSwap(swapId, {
              status: "Error",
              isProcessing: false,
              error: res.statuses.find((s) => s.includes("Failed")),
            });
            toastStore.error(
              res.statuses.find((s) => s.includes("Failed")),
              8000,
            );
            toastStore.dismiss(toastId);
            return;
          }

          if ("Swap" in res.reply) {
            const swapStatus: SwapStatus = res.reply.Swap;
            swapStatusStore.updateSwap(swapId, {
              status: swapStatus.status,
              isProcessing: true,
              error: null,
            });

            if (swapStatus.status === "Success") {
              this.stopPolling();
              const formattedPayAmount = SwapService.fromBigInt(
                swapStatus.pay_amount,
                getTokenDecimals(swapStatus.pay_symbol),
              );
              const formattedReceiveAmount = SwapService.fromBigInt(
                swapStatus.receive_amount,
                getTokenDecimals(swapStatus.receive_symbol),
              );
              const token0 = get(tokenStore).tokens.find(
                (t) => t.symbol === swapStatus.pay_symbol,
              );
              const token1 = get(tokenStore).tokens.find(
                (t) => t.symbol === swapStatus.receive_symbol,
              );

              // Update swap status with complete details
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
                }
              });

              // Load updated balances immediately and after delays
              const tokens = get(tokenStore).tokens;
              const payToken = tokens.find((t) => t.symbol === swapStatus.pay_symbol);
              const receiveToken = tokens.find((t) => t.symbol === swapStatus.receive_symbol);
              const walletId = auth?.pnp?.account?.owner?.toString();

              if (!payToken || !receiveToken || !walletId) {
                console.error("Missing token or wallet info for balance update");
                toastStore.dismiss(toastId);
                return;
              }

              console.log("Swap completed successfully, updating balances for tokens:", {
                payToken: payToken?.symbol,
                receiveToken: receiveToken?.symbol,
                walletId
              });

              const updateBalances = async () => {
                try {
                  console.log("Attempting to update balances...");
                  await tokenStore.loadBalancesForTokens(
                    [payToken, receiveToken],
                    Principal.fromText(walletId)
                  );
                  console.log("Successfully updated balances");
                } catch (error) {
                  console.error("Error updating balances:", error);
                }
              };

              // Update immediately
              await updateBalances();

              // Schedule updates with increasing delays
              const delays = [1000, 2000, 3000, 4000, 5000];
              console.log("Scheduling delayed balance updates...");
              delays.forEach(delay => {
                setTimeout(async () => {
                  await updateBalances();
                }, delay);
              });

              toastStore.dismiss(toastId);
              return;
            } else if (swapStatus.status === "Failed") {
              this.stopPolling();
              swapStatusStore.updateSwap(swapId, {
                status: "Failed",
                isProcessing: false,
                error: "Swap failed",
              });
              toastStore.error("Swap failed");
              toastStore.dismiss(toastId);
              return;
            }
          }
        }

        attempts++;
      } catch (error) {
        console.error("Error monitoring swap:", error);
        this.stopPolling();
        swapStatusStore.updateSwap(swapId, {
          status: "Error",
          isProcessing: false,
          error: "Failed to monitor swap status",
        });
        toastStore.error("Failed to monitor swap status");
        toastStore.dismiss(toastId);
        return;
      }
    }, this.POLLING_INTERVAL);
  }

  private static stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval as any);
      this.pollingInterval = null;
    }
  }

  // Clean up method to be called when component unmounts
  public static cleanup() {
    this.stopPolling();
  }

  /**
   * Fetches the swap quote based on the provided amount and tokens.
   */
  public static async getSwapQuote(
    payToken: FE.Token,
    receiveToken: FE.Token,
    amount: string,
  ): Promise<{
    receiveAmount: string;
    slippage: number;
    usdValue: string;
  }> {
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
      return {
        receiveAmount: "0",
        slippage: 0,
        usdValue: "0",
      };
    }

    try {
      const payDecimals = getTokenDecimals(payToken.address);
      const payAmountBigInt = this.toBigInt(amount, payDecimals);
      const quote = await this.swap_amounts(
        payToken,
        payAmountBigInt,
        receiveToken,
      );

      if ("Ok" in quote) {
        const receiveDecimals = getTokenDecimals(receiveToken.address);
        const receivedAmount = this.fromBigInt(
          quote.Ok.receive_amount,
          receiveDecimals,
        );

        const store = get(tokenStore);
        const price = await tokenStore.refetchPrice(
          store.tokens.find((t) => t.address === receiveToken.address),
        );
        const usdValueNumber =
          parseFloat(receivedAmount) * parseFloat(price.toString());

        return {
          receiveAmount: receivedAmount,
          slippage: quote.Ok.slippage,
          usdValue: usdValueNumber.toString(),
        };
      } else if ("Err" in quote) {
        throw new Error(quote.Err);
      }
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
    tokenInfo: TokenInfo,
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
}
