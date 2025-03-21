// src/lib/services/swap/SwapService.ts
import { toastStore } from "$lib/stores/toastStore";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { swapStatusStore } from "$lib/stores/swapStore";
import { auth, canisterIDLs } from "$lib/stores/auth";
import { KONG_BACKEND_CANISTER_ID, KONG_CANISTER_ID } from "$lib/constants/canisterConstants";
import { requireWalletConnection } from "$lib/stores/auth";
import { SwapMonitor } from "./SwapMonitor";
import { fetchTokensByCanisterId } from "$lib/api/tokens";
import { allowanceStore } from "$lib/stores/allowanceStore";

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
   * Gets swap quote from backend
   */
  public static async swap_amounts(
    payToken: FE.Token,
    payAmount: bigint,
    receiveToken: FE.Token,
  ): Promise<BE.SwapQuoteResponse> {
    try {
      if (!payToken?.canister_id || !receiveToken?.canister_id) {
        throw new Error("Invalid tokens provided for swap quote");
      }
      const actor = await auth.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: true },
      );
      return await actor.swap_amounts(
        "IC." + payToken.canister_id,
        payAmount,
        "IC." + receiveToken.canister_id,
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

    const tokens = await fetchTokensByCanisterId([params.payToken.canister_id, params.receiveToken.canister_id]);
    const receiveToken = tokens.find(
      (t) => t.canister_id === params.receiveToken.canister_id,
    );
    const payToken = tokens.find((t) => t.canister_id === params.payToken.canister_id);
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
      const actor = auth.pnp.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        {
          anon: false,
          requiresSigning: auth.pnp.activeWallet.id === "plug",
        },
      );
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
  public static async requests(requestIds: bigint[]): Promise<RequestResponse> {
    try {
      const actor = await auth.pnp.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: true },
      );
      const result = await actor.requests(requestIds);
      return result;
    } catch (error) {
      console.error("Error getting request status:", error);
      throw error;
    }
  }

  /**
   * Executes complete swap flow with comprehensive debugging
   */
  public static async executeSwap(
    params: SwapExecuteParams,
  ): Promise<bigint | false> {
    const swapId = params.swapId;
    console.log(`[SwapService][executeSwap] Starting swap execution for ID: ${swapId}`, {
      payToken: params.payToken.symbol,
      payAmount: params.payAmount,
      receiveToken: params.receiveToken.symbol,
      receiveAmount: params.receiveAmount,
      maxSlippage: params.userMaxSlippage
    });
    
    try {
      // Debug the wallet connection and token properties
      console.log(`[SwapService][executeSwap] Wallet status:`, {
        connected: !!auth.pnp.activeWallet,
        activeWalletId: auth.pnp.activeWallet?.id,
        principal: auth.pnp.activeWallet?.principal
      });
      
      console.log(`[SwapService][executeSwap] Pay token details:`, {
        symbol: params.payToken.symbol,
        canisterId: params.payToken.canister_id,
        address: params.payToken.address,
        decimals: params.payToken.decimals,
        icrc1: params.payToken.icrc1,
        icrc2: params.payToken.icrc2,
        feeFixed: params.payToken.fee_fixed?.toString()
      });
      
      console.log(`[SwapService][executeSwap] Receive token details:`, {
        symbol: params.receiveToken.symbol,
        canisterId: params.receiveToken.canister_id,
        address: params.receiveToken.address,
        decimals: params.receiveToken.decimals
      });

      // Add check for blocked tokens at the start
      if (BLOCKED_TOKEN_IDS.includes(params.payToken.canister_id) || 
          BLOCKED_TOKEN_IDS.includes(params.receiveToken.canister_id)) {
        console.log(`[SwapService][executeSwap] Blocked token detected`);
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

      // Check wallet connection
      console.log(`[SwapService][executeSwap] Checking wallet connection...`);
      requireWalletConnection();
      console.log(`[SwapService][executeSwap] Wallet connection verified`);
      
      const payToken = params.payToken
      if (!payToken) {
        console.error("[SwapService][executeSwap] Pay token not found:", params.payToken);
        throw new Error(`Pay token ${params.payToken.symbol} not found`);
      }

      // Convert to BigInt with proper decimal handling
      const payAmount = SwapService.toBigInt(
        params.payAmount,
        payToken.decimals,
      );
      console.log(`[SwapService][executeSwap] Converted pay amount to BigInt:`, {
        original: params.payAmount,
        bigIntValue: payAmount.toString(),
        decimals: payToken.decimals
      });

      const receiveToken = params.receiveToken
      if (!receiveToken) {
        console.error("[SwapService][executeSwap] Receive token not found:", params.receiveToken);
        throw new Error(
          `Receive token ${params.receiveToken.symbol} not found`,
        );
      }

      let txId: bigint | false;
      let approvalId: bigint | false;
      const toastId = toastStore.info(
        `Swapping ${params.payAmount} ${params.payToken.symbol} to ${params.receiveAmount} ${params.receiveToken.symbol}...`,
        { duration: 20000 },
      );
      
      // IMPORTANT DEBUG: Get the values from allowanceStore to check existing allowances
      console.log(`[SwapService][executeSwap] Checking current allowance in store before proceeding...`);
      try {
        const allowanceStoreValue = allowanceStore.getAllowance(
          payToken.canister_id,
          auth.pnp.account.owner.toString(),
          params.backendPrincipal.toString()
        );
        console.log(`[SwapService][executeSwap] Current stored allowance:`, {
          token: payToken.symbol,
          spender: params.backendPrincipal.toString(),
          allowance: allowanceStoreValue ? allowanceStoreValue.toString() : '0'
        });
      } catch (allowanceError) {
        console.error(`[SwapService][executeSwap] Error getting current allowance:`, allowanceError);
      }
      
      if (payToken.icrc2) {
        console.log(`[SwapService][executeSwap] Token supports ICRC2, checking/requesting allowance...`);
        const requiredAllowance = payAmount;
        
        console.log(`[SwapService][executeSwap] Requesting allowance of ${requiredAllowance.toString()} ${payToken.symbol}`);
        console.log(`[SwapService][executeSwap] Backend principal for allowance:`, params.backendPrincipal.toString());
        
        // CRITICAL: Direct check of current allowance from canister
        try {
          const directAllowance = await IcrcService.checkIcrc2Allowance(
            payToken,
            auth.pnp.account.owner,
            params.backendPrincipal
          );
          console.log(`[SwapService][executeSwap] Direct allowance check from canister:`, {
            token: payToken.symbol,
            spender: params.backendPrincipal.toString(),
            allowance: directAllowance.toString()
          });
        } catch (directAllowanceError) {
          console.error(`[SwapService][executeSwap] Error checking direct allowance:`, directAllowanceError);
        }
        
        approvalId = await IcrcService.checkAndRequestIcrc2Allowances(
          payToken,
          requiredAllowance,
        );
        console.log(`[SwapService][executeSwap] Allowance request result:`, {
          approvalId: approvalId ? approvalId.toString() : 'false',
          status: approvalId ? 'success' : 'failed'
        });
        
        // IMPORTANT: Verify the allowance was actually set
        try {
          const verifyAllowance = await IcrcService.checkIcrc2Allowance(
            payToken,
            auth.pnp.account.owner,
            params.backendPrincipal
          );
          console.log(`[SwapService][executeSwap] Post-approval allowance verification:`, {
            token: payToken.symbol,
            spender: params.backendPrincipal.toString(),
            allowance: verifyAllowance.toString(),
            requiredAllowance: requiredAllowance.toString(),
            sufficient: verifyAllowance >= requiredAllowance
          });
        } catch (verifyError) {
          console.error(`[SwapService][executeSwap] Error verifying allowance after approval:`, verifyError);
        }
        
      } else if (payToken.icrc1) {
        console.log(`[SwapService][executeSwap] Token supports ICRC1, executing direct transfer...`);
        const result = await IcrcService.transfer(
          payToken,
          params.backendPrincipal,
          payAmount,
          { fee: BigInt(payToken.fee_fixed) },
        );

        console.log(`[SwapService][executeSwap] ICRC1 transfer result:`, result);
        if (result?.Ok) {
          txId = result.Ok;
          console.log(`[SwapService][executeSwap] Transfer successful, txId:`, txId.toString());
        } else {
          txId = false;
          console.error(`[SwapService][executeSwap] Transfer failed:`, result?.Err || 'Unknown error');
        }
      } else {
        console.error(`[SwapService][executeSwap] Token ${payToken.symbol} doesn't support ICRC1 or ICRC2`);
        throw new Error(
          `Token ${payToken.symbol} does not support ICRC1 or ICRC2`,
        );
      }

      if (txId === false || approvalId === false) {
        console.error(`[SwapService][executeSwap] Transaction failed during transfer/approval phase`);
        swapStatusStore.updateSwap(swapId, {
          status: "Failed",
          isProcessing: false,
          error: "Transaction failed during transfer/approval",
        });
        toastStore.error("Transaction failed during transfer/approval");
        return false;
      }

      // Prepare swap parameters
      const swapParams = {
        pay_token: "IC." + params.payToken.address,
        pay_amount: BigInt(payAmount),
        receive_token: "IC." + params.receiveToken.address,
        receive_amount: [],
        max_slippage: [params.userMaxSlippage],
        receive_address: [],
        referred_by: [],
        pay_tx_id: txId ? [{ BlockIndex: Number(txId) }] : [],
      };
      
      console.log(`[SwapService][executeSwap] Prepared swap parameters:`, {
        pay_token: swapParams.pay_token,
        pay_amount: swapParams.pay_amount.toString(),
        receive_token: swapParams.receive_token,
        max_slippage: swapParams.max_slippage,
        pay_tx_id: swapParams.pay_tx_id
      });

      // Execute the swap
      console.log(`[SwapService][executeSwap] Executing swap_async...`);
      const result = await SwapService.swap_async(swapParams);
      console.log(`[SwapService][executeSwap] swap_async result:`, result);

      if (result.Ok) {
        console.log(`[SwapService][executeSwap] Swap initiated successfully, requestId:`, result.Ok.toString());
        console.log(`[SwapService][executeSwap] Starting transaction monitoring...`);
        SwapMonitor.monitorTransaction(result?.Ok, swapId, toastId);
        return result.Ok;
      } else {
        console.error(`[SwapService][executeSwap] Swap error:`, result.Err);
        return false;
      }
    } catch (error) {
      console.error(`[SwapService][executeSwap] Exception during swap execution:`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      swapStatusStore.updateSwap(swapId, {
        status: "Failed",
        isProcessing: false,
        error: error instanceof Error ? error.message : "Swap failed",
      });
      toastStore.error(error instanceof Error ? error.message : "Swap failed");
      return false;
    }
  }

  /**
   * Fetches the swap quote based on the provided amount and tokens.
   */
  public static async getSwapQuote(
    payToken: FE.Token,
    receiveToken: FE.Token,
    payAmount: string,
  ): Promise<{ receiveAmount: string; slippage: number }> {
    try {
      // Add check for blocked tokens at the start
      if (BLOCKED_TOKEN_IDS.includes(payToken.canister_id) || 
          BLOCKED_TOKEN_IDS.includes(receiveToken.canister_id)) {
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

    // Function to get the principal ID

  /**
   * Gets KONG to ICP swap quote
   */
  public static async getKongToIcpQuote(
    kongAmountE8s: bigint,
    kongDecimals: number,
    icpDecimals: number,
  ): Promise<{ receiveAmount: string; slippage: number }> {
    try {
      console.log("Getting KONG to ICP swap quote");
      const actor = await auth.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: true }
      );
      
      const quote = await actor.swap_amounts(
        "KONG",
        kongAmountE8s,
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
    kongAmountE8s: bigint,
    maxSlippage: number = 2.0,
  ): Promise<bigint> {
    try {

      
      console.log('[SwapService][swapKongToIcp] Starting swap with params:', {
        kongAmount: kongAmountE8s.toString(),
        maxSlippage
      });
      
      // Get the principal from wallet - try multiple methods for better compatibility
      let principal = auth.pnp.activeWallet?.principal;
      
      // Fallback to account owner if activeWallet principal is not available
      if (!principal && auth.pnp?.account?.owner) {
        principal = auth.pnp.account.owner;
      }
      
      if (!principal) {
        throw new Error("Please connect your wallet to continue");
      }
      
      // Convert principal to proper format if needed
      const principalObj = typeof principal === 'string' 
        ? Principal.fromText(principal) 
        : principal;
      
      // First get Kong actor to approve the swap - using auth.getActor consistently
      console.log('[SwapService][swapKongToIcp] Getting Kong actor...');
      const kongActor = await auth.getActor(
        KONG_CANISTER_ID,
        canisterIDLs.icrc2,
        { anon: false }
      );
      
      // Get name using anonymous actor for read operations
      const anonKongActor = await auth.getActor(
        KONG_CANISTER_ID,
        canisterIDLs.icrc2,
        { anon: true }
      );
      
      console.log('[SwapService][swapKongToIcp] Kong actor obtained with identity');

      // Check KONG balance before approval
      try {
        const balance = await anonKongActor.icrc1_balance_of({
          owner: principalObj,
          subaccount: []
        });
        console.log('[SwapService][swapKongToIcp] Current KONG balance:', {
          balance: balance.toString(),
          requiredAmount: kongAmountE8s.toString()
        });
      } catch (balanceError) {
        console.error('[SwapService][swapKongToIcp] Failed to fetch KONG balance:', balanceError);
      }

      console.log('[SwapService][swapKongToIcp] Getting backend actor...');
      // Use auth.getActor consistently here too
      const backendActor = await auth.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: false }
      );
      
      // Get backend principal directly from canister ID
      console.log('[SwapService][swapKongToIcp] Creating backend principal from:', KONG_BACKEND_CANISTER_ID);
      const backendPrincipal = Principal.fromText(KONG_BACKEND_CANISTER_ID);
      
      // Add 10% buffer to approval amount
      const approveAmount = kongAmountE8s * BigInt(110) / BigInt(100);
      console.log('[SwapService][swapKongToIcp] Calculated approval amount:', {
        original: kongAmountE8s.toString(),
        withBuffer: approveAmount.toString(),
        bufferPercent: '10%'
      });
      
      // Check current allowance before approval
      try {
        const currentAllowance = await anonKongActor.icrc2_allowance({
          account: {
            owner: principalObj,
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
          subaccount: [],
        },
        amount: approveAmount,
        fee: [BigInt(10000)],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      };

      console.log('[SwapService][swapKongToIcp] Calling icrc2_approve...');
      
      // Add a timeout promise to handle potential channel closure
      const approvePromise = kongActor.icrc2_approve(approveArgs);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Approval timed out - please try again")), 60000);
      });
      
      // Race the approval against the timeout
      const approveResult = await Promise.race([approvePromise, timeoutPromise])
        .catch(error => {
          // Check if this is a channel closure error
          if (error.message && (
              error.message.includes("Channel was closed") || 
              error.message.includes("No Agent could be found")
            )) {
            console.error('[SwapService][swapKongToIcp] Channel closed during approval:', error);
            throw new Error("Wallet connection was interrupted. Please try again and keep the wallet window open until the transaction completes.");
          }
          throw error;
        });
      
      console.log('[SwapService][swapKongToIcp] Approve result:', approveResult);

      if ("Err" in approveResult) {
        console.error('[SwapService][swapKongToIcp] Approval failed:', {
          error: approveResult.Err,
          args: approveArgs,
          identity: principalObj.toString(),
          backendPrincipal: backendPrincipal.toString()
        });
        throw new Error(typeof approveResult.Err === 'string' ? approveResult.Err : 'Failed to approve Kong backend');
      }

      console.log('[SwapService][swapKongToIcp] Approval successful, constructing swap args...');

      // Execute the swap
      const swapArgs = {
        pay_token: "KONG",
        pay_amount: kongAmountE8s,
        receive_token: "ICP",
        receive_amount: [],
        max_slippage: [maxSlippage],
        receive_address: [],
        referred_by: [],
        pay_tx_id: [],
      };

      // Create a safe serializer function for BigInt values
      const safeStringifyWithBigInt = (obj: any) => {
        return JSON.stringify(obj, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
      };

      console.log('[SwapService][swapKongToIcp] Swap args:', safeStringifyWithBigInt(swapArgs));

      console.log('[SwapService][swapKongToIcp] Executing swap...');
      const result = await backendActor.swap(swapArgs);
      console.log('[SwapService][swapKongToIcp] Swap result:', safeStringifyWithBigInt(result));

      if ("Ok" in result) {
        console.log('[SwapService][swapKongToIcp] Swap successful, receive amount:', result.Ok.receive_amount.toString());
        return result.Ok.receive_amount;
      }

      console.error('[SwapService][swapKongToIcp] Swap failed:', result.Err);
      throw new Error(typeof result.Err === 'string' ? result.Err : 'Swap failed');
    } catch (error) {
      console.error("[SwapService][swapKongToIcp] Error executing KONG/ICP swap:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error?.constructor?.name
      });
      
      // Create more user-friendly error message
      let userMessage = "Failed to swap KONG to ICP";
      
      if (error instanceof Error) {
        if (error.message.includes("Wallet not connected")) {
          userMessage = "Please connect your wallet to continue";
        } else if (error.message.includes("Channel was closed") || 
                  error.message.includes("No Agent could be found")) {
          userMessage = "Wallet connection was interrupted. Please try again and keep the wallet window open";
        } else if (error.message.includes("Insufficient balance")) {
          userMessage = "Insufficient KONG balance for this swap";
        } else if (error.message.includes("serialization")) {
          userMessage = "Error processing response from wallet. Please try again";
        } else {
          userMessage = error.message;
        }
      }
      
      const enhancedError = new Error(userMessage);
      if (error instanceof Error) {
        enhancedError.stack = error.stack;
      }
      throw enhancedError;
    }
  }

  /**
   * Gets KONG to TCYCLES swap quote
   */
  public static async getKongToTCyclesQuote(
    kongAmountE8s: bigint,
    kongDecimals: number,
    tcyclesDecimals: number,
  ): Promise<{ receiveAmount: string; slippage: number }> {
    try {
      console.log("Getting KONG to TCYCLES swap quote");
      const actor = await auth.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: true }
      );
      
      // Use the TCYCLES ledger canister ID for the target token
      const TCYCLES_LEDGER_CANISTER_ID = "um5iw-rqaaa-aaaaq-qaaba-cai";
      
      const quote = await actor.swap_amounts(
        "KONG",
        kongAmountE8s,
        "IC." + TCYCLES_LEDGER_CANISTER_ID,
      );

      if ("Ok" in quote) {
        return {
          receiveAmount: this.fromBigInt(quote.Ok.receive_amount, tcyclesDecimals),
          slippage: quote.Ok.slippage,
        };
      }

      throw new Error(quote.Err || "Failed to get swap quote");
    } catch (error) {
      console.error("Error getting KONG/TCYCLES quote:", error);
      throw error;
    }
  }

  /**
   * Executes KONG to TCYCLES swap with proper approval
   * Higher slippage tolerance is implemented by design to accommodate smaller transactions (approximately 10 KONG),
   * which are inherently subject to greater relative price impact due to their limited size in relation to the liquidity pool
   */
  public static async swapKongToTCycles(
    kongAmountE8s: bigint,
    maxSlippage: number = 20.0,
  ): Promise<bigint> {
    try {
      console.log('[SwapService][swapKongToTCycles] Starting swap with params:', {
        kongAmount: kongAmountE8s.toString(),
        maxSlippage
      });
      
      // Get the principal from wallet - try multiple methods for better compatibility
      let principal = auth.pnp.activeWallet?.principal;
      
      // Fallback to account owner if activeWallet principal is not available
      if (!principal && auth.pnp?.account?.owner) {
        principal = auth.pnp.account.owner;
      }
      
      if (!principal) {
        throw new Error("Please connect your wallet to continue");
      }
      
      // Convert principal to proper format if needed
      const principalObj = typeof principal === 'string' 
        ? Principal.fromText(principal) 
        : principal;
      
      // First get Kong actor to approve the swap
      console.log('[SwapService][swapKongToTCycles] Getting Kong actor...');
      const kongActor = await auth.getActor(
        KONG_CANISTER_ID,
        canisterIDLs.icrc2,
        { anon: false }
      );
      
      // Get name using anonymous actor for read operations
      const anonKongActor = await auth.getActor(
        KONG_CANISTER_ID,
        canisterIDLs.icrc2,
        { anon: true }
      );
      
      console.log('[SwapService][swapKongToTCycles] Kong actor obtained with identity');

      // Check KONG balance before approval
      try {
        const balance = await anonKongActor.icrc1_balance_of({
          owner: principalObj,
          subaccount: []
        });
        console.log('[SwapService][swapKongToTCycles] Current KONG balance:', {
          balance: balance.toString(),
          requiredAmount: kongAmountE8s.toString()
        });
      } catch (balanceError) {
        console.error('[SwapService][swapKongToTCycles] Failed to fetch KONG balance:', balanceError);
      }

      console.log('[SwapService][swapKongToTCycles] Getting backend actor...');
      // Use auth.getActor consistently here too
      const backendActor = await auth.getActor(
        KONG_BACKEND_CANISTER_ID,
        canisterIDLs.kong_backend,
        { anon: false }
      );
      
      // Get backend principal directly from canister ID
      console.log('[SwapService][swapKongToTCycles] Creating backend principal from:', KONG_BACKEND_CANISTER_ID);
      const backendPrincipal = Principal.fromText(KONG_BACKEND_CANISTER_ID);
      
      // Add 10% buffer to approval amount
      const approveAmount = kongAmountE8s * BigInt(110) / BigInt(100);
      console.log('[SwapService][swapKongToTCycles] Calculated approval amount:', {
        original: kongAmountE8s.toString(),
        withBuffer: approveAmount.toString(),
        bufferPercent: '10%'
      });
      
      // Check current allowance before approval
      try {
        const currentAllowance = await anonKongActor.icrc2_allowance({
          account: {
            owner: principalObj,
            subaccount: []
          },
          spender: {
            owner: backendPrincipal,
            subaccount: []
          }
        });
        console.log('[SwapService][swapKongToTCycles] Current allowance:', currentAllowance);
      } catch (allowanceError) {
        console.error('[SwapService][swapKongToTCycles] Failed to fetch current allowance:', allowanceError);
      }
      
      // Approve Kong backend to spend tokens
      const approveArgs = {
        spender: {
          owner: backendPrincipal,
          subaccount: [],
        },
        amount: approveAmount,
        fee: [BigInt(10000)],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      };

      console.log('[SwapService][swapKongToTCycles] Calling icrc2_approve...');
      
      // Add a timeout promise to handle potential channel closure
      const approvePromise = kongActor.icrc2_approve(approveArgs);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Approval timed out - please try again")), 60000);
      });
      
      // Race the approval against the timeout
      const approveResult = await Promise.race([approvePromise, timeoutPromise])
        .catch(error => {
          // Check if this is a channel closure error
          if (error.message && (
              error.message.includes("Channel was closed") || 
              error.message.includes("No Agent could be found")
            )) {
            console.error('[SwapService][swapKongToTCycles] Channel closed during approval:', error);
            throw new Error("Wallet connection was interrupted. Please try again and keep the wallet window open until the transaction completes.");
          }
          throw error;
        });
      
      console.log('[SwapService][swapKongToTCycles] Approve result:', approveResult);

      if ("Err" in approveResult) {
        console.error('[SwapService][swapKongToTCycles] Approval failed:', {
          error: approveResult.Err,
          args: approveArgs,
          identity: principalObj.toString(),
          backendPrincipal: backendPrincipal.toString()
        });
        throw new Error(typeof approveResult.Err === 'string' ? approveResult.Err : 'Failed to approve Kong backend');
      }

      console.log('[SwapService][swapKongToTCycles] Approval successful, constructing swap args...');

      // TCYCLES ledger canister ID
      const TCYCLES_LEDGER_CANISTER_ID = "um5iw-rqaaa-aaaaq-qaaba-cai";
      
      // Execute the swap
      const swapArgs = {
        pay_token: "KONG",
        pay_amount: kongAmountE8s,
        receive_token: "IC." + TCYCLES_LEDGER_CANISTER_ID,
        receive_amount: [],
        max_slippage: [maxSlippage],
        receive_address: [],
        referred_by: [],
        pay_tx_id: [],
      };

      // Create a safe serializer function for BigInt values
      const safeStringifyWithBigInt = (obj: any) => {
        return JSON.stringify(obj, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
      };

      console.log('[SwapService][swapKongToTCycles] Swap args:', safeStringifyWithBigInt(swapArgs));

      console.log('[SwapService][swapKongToTCycles] Executing swap...');
      const result = await backendActor.swap(swapArgs);
      console.log('[SwapService][swapKongToTCycles] Swap result:', safeStringifyWithBigInt(result));

      if ("Ok" in result) {
        console.log('[SwapService][swapKongToTCycles] Swap successful, receive amount:', result.Ok.receive_amount.toString());
        return result.Ok.receive_amount;
      }

      console.error('[SwapService][swapKongToTCycles] Swap failed:', result.Err);
      throw new Error(typeof result.Err === 'string' ? result.Err : 'Swap failed');
    } catch (error) {
      console.error("[SwapService][swapKongToTCycles] Error executing KONG/TCYCLES swap:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error?.constructor?.name
      });
      
      // Create more user-friendly error message
      let userMessage = "Failed to swap KONG to TCYCLES";
      
      if (error instanceof Error) {
        if (error.message.includes("Wallet not connected")) {
          userMessage = "Please connect your wallet to continue";
        } else if (error.message.includes("Channel was closed") || 
                  error.message.includes("No Agent could be found")) {
          userMessage = "Wallet connection was interrupted. Please try again and keep the wallet window open";
        } else if (error.message.includes("Insufficient balance")) {
          userMessage = "Insufficient KONG balance for this swap";
        } else if (error.message.includes("serialization")) {
          userMessage = "Error processing response from wallet. Please try again";
        } else {
          userMessage = error.message;
        }
      }
      
      const enhancedError = new Error(userMessage);
      if (error instanceof Error) {
        enhancedError.stack = error.stack;
      }
      throw enhancedError;
    }
  }
}
