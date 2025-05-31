// Cross-chain swap service for handling Solana <-> ICP swaps
import { auth } from "$lib/stores/auth";
import { canisters, type CanisterType } from "$lib/config/auth.config";
import { SolanaService } from "$lib/services/solana/SolanaService";
import { IcrcService } from "$lib/services/icrc/IcrcService";
import { get } from "svelte/store";
import { userTokens } from "$lib/stores/userTokens";
import type { AnyToken } from "$lib/utils/tokenUtils";
import { isKongToken, isSolanaToken, getTokenId } from "$lib/utils/tokenUtils";
import { Principal } from "@dfinity/principal";
import BigNumber from "bignumber.js";

export type SwapMode = 'SOL_TO_ICP' | 'ICP_TO_SOL' | 'SOL_TO_SPL' | 'SPL_TO_SPL';

export interface CrossChainSwapArgs {
  payToken: AnyToken;
  payAmount: bigint;
  payAddress?: string;
  payTxId?: string;
  receiveToken: AnyToken;
  receiveAmount?: bigint;
  receiveAddress?: string;
  maxSlippage: number;
  timestamp?: bigint;
  signature?: string;
}

export interface CrossChainSwapResult {
  job_id?: bigint;
  status?: string;
  error?: string;
}

export interface SwapJob {
  id: bigint;
  status: { [key: string]: any };
  pay_tx_signature?: string[];
  solana_tx_signature_of_payout?: string[];
}

export class CrossChainSwapService {
  
  /**
   * Determines the swap mode based on tokens
   */
  public static getSwapMode(payToken: AnyToken, receiveToken: AnyToken): SwapMode | null {
    const payIsSolana = isSolanaToken(payToken);
    const receiveIsSolana = isSolanaToken(receiveToken);
    
    if (payIsSolana && !receiveIsSolana) {
      return 'SOL_TO_ICP';
    } else if (!payIsSolana && receiveIsSolana) {
      return 'ICP_TO_SOL';
    } else if (payIsSolana && receiveIsSolana) {
      // Both are Solana tokens
      if (payToken.symbol === 'SOL' || receiveToken.symbol === 'SOL') {
        return 'SOL_TO_SPL'; // At least one is native SOL
      } else {
        return 'SPL_TO_SPL'; // Both are SPL tokens
      }
    }
    
    return null; // Not a cross-chain swap (both are ICP tokens)
  }

  /**
   * Get actor for cross-chain operations
   */
  private static async getActor(authenticated = false) {
    if (authenticated) {
      return auth.pnp.getActor<CanisterType['KONG_SOLANA_BACKEND']>({
        canisterId: canisters.kongSolanaBackend.canisterId!,
        idl: canisters.kongSolanaBackend.idl,
        anon: false,
        requiresSigning: false,
      });
    } else {
      // Anonymous actor for quotes
      return auth.pnp.getActor<CanisterType['KONG_SOLANA_BACKEND']>({
        canisterId: canisters.kongSolanaBackend.canisterId!,
        idl: canisters.kongSolanaBackend.idl,
        anon: true,
      });
    }
  }

  /**
   * Fetch token prices from CoinGecko
   */
  public static async fetchTokenPrices(): Promise<Record<string, number>> {
    const cache = this.priceCache;
    const now = Date.now();
    
    // Return cached prices if still valid (1 minute for more accurate prices)
    if (cache.timestamp && now - cache.timestamp < 1 * 60 * 1000) {
      return cache.prices;
    }

    try {
      // Use different approaches for dev and production
      let solResponse, trumpResponse, icpResponse;
      
      if (import.meta.env.DEV) {
        // Use Vite proxy in development
        const baseUrl = '/coingecko';
        [solResponse, trumpResponse, icpResponse] = await Promise.all([
          fetch(`${baseUrl}/api/v3/simple/price?ids=solana&vs_currencies=usd`),
          fetch(`${baseUrl}/api/v3/simple/price?ids=official-trump&vs_currencies=usd`),
          fetch(`${baseUrl}/api/v3/simple/price?ids=internet-computer&vs_currencies=usd`)
        ]);
      } else {
        // Use our API endpoint in production
        [solResponse, trumpResponse, icpResponse] = await Promise.all([
          fetch(`/api/coingecko?ids=solana&vs_currencies=usd`),
          fetch(`/api/coingecko?ids=official-trump&vs_currencies=usd`),
          fetch(`/api/coingecko?ids=internet-computer&vs_currencies=usd`)
        ]);
      }

      const solData = await solResponse.json();
      const trumpData = await trumpResponse.json();
      const icpData = await icpResponse.json();

      const prices = {
        SOL: solData.solana?.usd || 162,
        TRUMP: trumpData['official-trump']?.usd || 11,
        USDC: 1, // USDC is always $1
        ICP: icpData['internet-computer']?.usd || 12
      };

      console.log('Fetched real-time prices:', prices);

      // Update cache
      this.priceCache = {
        prices,
        timestamp: now
      };

      return prices;
    } catch (error) {
      console.error('Failed to fetch token prices:', error);
      // Return more accurate fallback prices (updated 2025)
      return {
        SOL: 162,
        TRUMP: 11,
        USDC: 1,
        ICP: 12
      };
    }
  }

  // Add price cache
  private static priceCache: {
    prices: Record<string, number>;
    timestamp: number;
  } = {
    prices: {},
    timestamp: 0
  };

  /**
   * Force refresh price cache
   */
  public static async refreshPrices(): Promise<void> {
    this.priceCache.timestamp = 0; // Reset timestamp to force refresh
    await this.fetchTokenPrices();
  }

  /**
   * Get swap quote for cross-chain swaps
   */
  public static async getQuote(
    payToken: AnyToken,
    payAmount: bigint,
    receiveToken: AnyToken
  ): Promise<{ receiveAmount: bigint; price: number }> {
    const swapMode = this.getSwapMode(payToken, receiveToken);
    if (!swapMode) {
      throw new Error("Not a cross-chain swap");
    }

    try {
      // Get actor without authentication for quotes
      const actor = await this.getActor(false);
      
      // Build swap args for quote (without signature and tx_id)
      const quoteArgs = {
        pay_token: payToken.symbol,
        pay_amount: payAmount,
        pay_address: [], // Empty for quote
        pay_tx_id: [],
        receive_token: receiveToken.symbol,
        receive_amount: [], // Let backend calculate
        receive_address: [],
        max_slippage: [1.0], // 1% default for quotes
        referred_by: [],
        timestamp: [],
        signature: []
      };

      // Call the swap method in "quote mode" by not providing required fields
      // The backend should return an error with the calculated amounts
      try {
        await actor.swap(quoteArgs);
        // If it doesn't fail, something is wrong
        throw new Error("Unexpected success response for quote");
      } catch (error: any) {
        // Parse the error message to extract quote information
        const errorMessage = error.message || error.toString();
        
        // Check if error contains quote information
        if (errorMessage.includes('receive_amount')) {
          // Extract the receive amount from error message
          const match = errorMessage.match(/receive_amount[:\s]+(\d+)/i);
          if (match) {
            const receiveAmount = BigInt(match[1]);
            const payAmountNumber = Number(payAmount) / Math.pow(10, payToken.decimals);
            const receiveAmountNumber = Number(receiveAmount) / Math.pow(10, receiveToken.decimals);
            const price = receiveAmountNumber / payAmountNumber;
            
            return {
              receiveAmount,
              price
            };
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get quote from backend, using real-time prices:', error);
    }

    // Get real-time prices from CoinGecko
    const prices = await this.fetchTokenPrices();
    
    // Calculate exchange rate based on USD prices
    const payTokenPrice = prices[payToken.symbol] || 1;
    const receiveTokenPrice = prices[receiveToken.symbol] || 1;
    
    console.log(`Price calculation - ${payToken.symbol}: $${payTokenPrice}, ${receiveToken.symbol}: $${receiveTokenPrice}`);
    
    // Exchange rate: how many receive tokens per pay token
    const exchangeRate = payTokenPrice / receiveTokenPrice;
    
    const payAmountNumber = Number(payAmount) / Math.pow(10, payToken.decimals);
    const receiveAmountNumber = payAmountNumber * exchangeRate;
    const receiveAmount = BigInt(Math.floor(receiveAmountNumber * Math.pow(10, receiveToken.decimals)));

    console.log(`Exchange rate: 1 ${payToken.symbol} = ${exchangeRate.toFixed(6)} ${receiveToken.symbol}`);
    console.log(`Swap: ${payAmountNumber} ${payToken.symbol} → ${receiveAmountNumber.toFixed(6)} ${receiveToken.symbol}`);

    return {
      receiveAmount,
      price: exchangeRate
    };
  }

  /**
   * Wait for manual transaction to be confirmed by canister
   */
  public static async waitForManualTransaction(
    signature: string,
    onStatusUpdate?: (message: string) => void
  ): Promise<boolean> {
    console.log(`[CrossChainSwapService] Waiting for manual transaction: ${signature}`);
    if (onStatusUpdate) {
      onStatusUpdate("Waiting for transaction to be detected by Kong canister...");
    }
    
    // Use longer timeout for manual transactions as user needs time to send
    return this.verifyTransactionInCanister(signature, onStatusUpdate, 120, 500); // 60 seconds
  }

  /**
   * Execute cross-chain swap
   */
  public static async executeSwap(args: CrossChainSwapArgs): Promise<CrossChainSwapResult> {
    const swapMode = this.getSwapMode(args.payToken, args.receiveToken);
    if (!swapMode) {
      throw new Error("Not a cross-chain swap");
    }

    const actor = await this.getActor(true);

    // If transaction ID is provided, verify it first
    if (args.payTxId) {
      console.log(`[CrossChainSwapService] Verifying provided transaction ID: ${args.payTxId}`);
      const isConfirmed = await this.verifyTransactionInCanister(args.payTxId);
      if (!isConfirmed) {
        throw new Error("Transaction not yet confirmed by Kong canister. Please wait and try again.");
      }
    }

    // Build swap arguments based on swap mode
    const swapArgs = {
      pay_token: args.payToken.symbol,
      pay_amount: args.payAmount,
      pay_address: args.payAddress ? [args.payAddress] : [],
      pay_tx_id: args.payTxId ? [{ TransactionHash: args.payTxId }] : [],
      receive_token: args.receiveToken.symbol,
      receive_amount: args.receiveAmount ? [args.receiveAmount] : [],
      receive_address: args.receiveAddress ? [args.receiveAddress] : [],
      max_slippage: [args.maxSlippage],
      referred_by: [],
      timestamp: args.timestamp ? [args.timestamp] : [],
      signature: args.signature ? [args.signature] : []
    };

    console.log(`[CrossChainSwapService] Sending swap args to backend:`, {
      ...swapArgs,
      pay_amount: swapArgs.pay_amount.toString(), // Convert BigInt to string for logging
      receive_amount: swapArgs.receive_amount.map(amt => amt.toString()),
      timestamp: swapArgs.timestamp.map(ts => ts.toString())
    });

    const response = await actor.swap(swapArgs);

    if ('Ok' in response) {
      return {
        job_id: response.Ok.job_id?.[0],
        status: 'success'
      };
    } else {
      return {
        error: response.Err,
        status: 'error'
      };
    }
  }

  /**
   * Verify transaction exists in canister using get_solana_transaction
   */
  public static async verifyTransactionInCanister(
    signature: string,
    onStatusUpdate?: (message: string) => void,
    maxRetries = 60, // 60 attempts at 500ms = 30 seconds total
    retryDelay = 500 // Check every 500ms
  ): Promise<boolean> {
    const actor = await this.getActor(true);
    console.log(`[CrossChainSwapService] Starting transaction verification for: ${signature}`);
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Use get_solana_transaction directly - this is the proper way
        const txResult = await actor.get_solana_transaction(signature);
        
        if (txResult && txResult.length > 0 && txResult[0]) {
          const tx = txResult[0];
          console.log(`[CrossChainSwapService] Transaction ${signature} found!`);
          console.log(`  Status: ${tx.status}`);
          console.log(`  Metadata: ${tx.metadata?.[0] || 'none'}`);
          
          // Transaction found and processed by canister
          if (onStatusUpdate) {
            onStatusUpdate("Transaction confirmed by Kong canister! Proceeding with swap...");
          }
          return true;
        }
        
        // Progress updates for user
        if (onStatusUpdate) {
          if (i === 0) {
            onStatusUpdate("Waiting for Kong canister to process transaction...");
          } else if (i === 3) { // After 1.5 seconds
            onStatusUpdate("Transaction detected, processing...");
          } else if (i === 9) { // After 4.5 seconds
            onStatusUpdate("Still processing, this can take a few seconds...");
          } else if (i === 20) { // After 10 seconds
            onStatusUpdate("Transaction processing taking longer than usual...");
          }
        }
        
      } catch (error) {
        console.warn(`[CrossChainSwapService] Error checking transaction ${signature}:`, error);
      }
      
      // Don't wait on the last iteration
      if (i < maxRetries - 1) {
        if ((i + 1) % 10 === 0) { // Log every 5 seconds (10 * 500ms)
          console.log(`[CrossChainSwapService] Still waiting... checked ${i + 1} times (${(i + 1) * retryDelay / 1000}s elapsed)`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    console.error(`[CrossChainSwapService] Transaction ${signature} not found after ${maxRetries} attempts (${maxRetries * retryDelay / 1000}s total)`);
    if (onStatusUpdate) {
      onStatusUpdate("Transaction verification timed out. Please try again.");
    }
    return false;
  }

  /**
   * Handle SOL to ICP swap
   */
  public static async executeSolToIcpSwap(
    payToken: AnyToken,
    payAmount: string,
    receiveToken: AnyToken,
    userPrincipal: string,
    solanaAddress?: string,
    onStatusUpdate?: (message: string) => void
  ): Promise<CrossChainSwapResult> {
    // Get Kong's Solana address
    const kongSolanaAddress = await SolanaService.getKongSolanaAddress();
    
    // Check if wallet can send SOL automatically
    const capabilities = SolanaService.getSolanaCapabilities();
    let payTxId: string | undefined;
    let signature: string | undefined;

    if (capabilities.canSendSol && solanaAddress && payToken.symbol === 'SOL') {
      // Send SOL automatically
      if (onStatusUpdate) onStatusUpdate(`Sending ${payToken.symbol} transaction...`);
      payTxId = await SolanaService.sendSolWithWallet(kongSolanaAddress, parseFloat(payAmount));
      
      // Verify SOL transaction is in canister before proceeding
      if (onStatusUpdate) onStatusUpdate("Verifying transaction with Kong canister...");
      console.log(`[CrossChainSwapService] Verifying SOL transaction ${payTxId} is in canister...`);
      console.log(`  Amount: ${parseFloat(payAmount)} SOL (${parseFloat(payAmount) * Math.pow(10, payToken.decimals)} lamports)`);
      
      const isInCanister = await this.verifyTransactionInCanister(payTxId, onStatusUpdate);
      
      if (!isInCanister) {
        throw new Error("Transaction not confirmed by Kong canister. Please try again.");
      }
      
      if (onStatusUpdate) onStatusUpdate("Transaction verified! Initiating cross-chain swap...");
    } else if (solanaAddress && payToken.symbol !== 'SOL') {
      // Send SPL token
      if (onStatusUpdate) onStatusUpdate(`Sending ${payToken.symbol} transaction...`);
      if (!isSolanaToken(payToken)) {
        throw new Error(`Invalid Solana token: ${payToken.symbol}`);
      }
      payTxId = await SolanaService.sendSplTokenWithWallet(
        payToken.mint_address,
        kongSolanaAddress,
        parseFloat(payAmount)
      );
      
      // Verify SPL token transaction is in canister before proceeding
      if (onStatusUpdate) onStatusUpdate("Verifying transaction with Kong canister...");
      console.log(`[CrossChainSwapService] Verifying SPL token transaction ${payTxId} is in canister...`);
      console.log(`  Amount: ${parseFloat(payAmount)} ${payToken.symbol} (${parseFloat(payAmount) * Math.pow(10, payToken.decimals)} atomic units)`);
      
      const isInCanister = await this.verifyTransactionInCanister(payTxId, onStatusUpdate);
      
      if (!isInCanister) {
        throw new Error("Transaction not confirmed by Kong canister. Please try again.");
      }
      
      if (onStatusUpdate) onStatusUpdate("Transaction verified! Initiating cross-chain swap...");
    } else {
      // Manual transfer required
      throw new Error(`Manual ${payToken.symbol} transfer required to: ${kongSolanaAddress}`);
    }

    // Create canonical message for signing
    const timestamp = Date.now();
    const payAmountAtomic = BigInt(Math.floor(parseFloat(payAmount) * Math.pow(10, payToken.decimals)));
    
    console.log(`[CrossChainSwapService] Amount calculation for ${payToken.symbol}:`);
    console.log(`  - Input amount: ${payAmount}`);
    console.log(`  - Token decimals: ${payToken.decimals}`);
    console.log(`  - Calculated atomic amount: ${payAmountAtomic.toString()}`);
    console.log(`  - Expected atomic amount for 0.01 TRUMP: 10000`);
    
    // Calculate receive amount based on real prices
    const prices = await this.fetchTokenPrices();
    const payTokenPrice = prices[payToken.symbol] || 0;
    const receiveTokenPrice = prices[receiveToken.symbol] || 0;
    
    if (payTokenPrice === 0 || receiveTokenPrice === 0) {
      throw new Error(`Unable to fetch prices for ${payToken.symbol} or ${receiveToken.symbol}`);
    }
    
    const exchangeRate = payTokenPrice / receiveTokenPrice;
    const receiveAmountAtomic = BigInt(Math.floor(parseFloat(payAmount) * exchangeRate * Math.pow(10, receiveToken.decimals)));

    const messageParams = {
      pay_token: payToken.symbol,
      pay_amount: Number(payAmountAtomic),
      pay_address: solanaAddress || '',
      receive_token: receiveToken.symbol,
      receive_amount: Number(receiveAmountAtomic),
      receive_address: userPrincipal,
      max_slippage: 99.0,
      timestamp: Number(timestamp),
      referred_by: null
    };

    const message = SolanaService.createCanonicalMessage(messageParams);

    // Sign message if wallet supports it
    if (capabilities.canSignMessage) {
      signature = await SolanaService.signMessageRaw(message);
    }

    // Execute swap with the actual tokens passed as parameters

    return this.executeSwap({
      payToken,
      payAmount: payAmountAtomic,
      payAddress: solanaAddress,
      payTxId,
      receiveToken,
      receiveAmount: receiveAmountAtomic,
      receiveAddress: userPrincipal,
      maxSlippage: 99.0,
      timestamp: BigInt(timestamp),
      signature
    });
  }

  /**
   * Handle ICP to SOL swap
   */
  public static async executeIcpToSolSwap(
    payToken: AnyToken,
    payAmount: string,
    receiveToken: AnyToken,
    userPrincipal: string,
    solanaAddress: string,
    onStatusUpdate?: (message: string) => void
  ): Promise<CrossChainSwapResult> {
    // Check and request ICP approval
    if (onStatusUpdate) onStatusUpdate(`Checking ${payToken.symbol} allowance...`);
    
    if (isKongToken(payToken)) {
      const payAmountAtomic = BigInt(Math.floor(parseFloat(payAmount) * Math.pow(10, payToken.decimals)));
      if (onStatusUpdate) onStatusUpdate(`Approving ${payToken.symbol} transfer...`);
      await IcrcService.checkAndRequestIcrc2Allowances(
        payToken,
        payAmountAtomic,
        canisters.kongSolanaBackend.canisterId
      );
    }
    
    if (onStatusUpdate) onStatusUpdate(`Processing ${payToken.symbol} to ${receiveToken.symbol} swap...`);

    const payAmountAtomic = BigInt(Math.floor(parseFloat(payAmount) * Math.pow(10, payToken.decimals)));
    
    // Calculate receive amount based on real prices
    const prices = await this.fetchTokenPrices();
    const payTokenPrice = prices[payToken.symbol] || 0;
    const receiveTokenPrice = prices[receiveToken.symbol] || 0;
    
    if (payTokenPrice === 0 || receiveTokenPrice === 0) {
      throw new Error(`Unable to fetch prices for ${payToken.symbol} or ${receiveToken.symbol}`);
    }
    
    const exchangeRate = payTokenPrice / receiveTokenPrice;
    const receiveAmountAtomic = BigInt(Math.floor(parseFloat(payAmount) * exchangeRate * Math.pow(10, receiveToken.decimals)))

    return this.executeSwap({
      payToken,
      payAmount: payAmountAtomic,
      payAddress: userPrincipal,
      receiveToken,
      receiveAmount: receiveAmountAtomic,
      receiveAddress: solanaAddress,
      maxSlippage: 99.0,
      timestamp: BigInt(Date.now())
    });
  }

  /**
   * Poll job status
   */
  public static async getSwapJob(jobId: bigint): Promise<SwapJob | null> {
    const actor = await this.getActor(true);
    const jobStatus = await actor.get_swap_job(jobId);
    
    if (jobStatus && jobStatus.length > 0) {
      return jobStatus[0];
    }
    
    return null;
  }

  /**
   * Poll job until completion
   */
  public static async pollJobStatus(
    jobId: bigint,
    onUpdate?: (status: string, job: SwapJob) => void,
    maxAttempts = 25,
    interval = 1000
  ): Promise<SwapJob> {
    for (let i = 0; i < maxAttempts; i++) {
      const job = await this.getSwapJob(jobId);
      
      if (job) {
        const statusKey = Object.keys(job.status)[0];
        
        if (onUpdate) {
          onUpdate(statusKey, job);
        }
        
        if (statusKey === 'Confirmed' || statusKey === 'Failed') {
          return job;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Job polling timeout');
  }

  /**
   * Handle Solana-to-Solana swaps (SOL_TO_SPL or SPL_TO_SPL)
   * This is a demo implementation - in production this would use Jupiter or another Solana DEX
   */
  public static async executeSolanaToSolanaSwap(
    payToken: AnyToken,
    payAmount: string,
    receiveToken: AnyToken,
    userSolanaAddress: string,
    onStatusUpdate?: (message: string) => void
  ): Promise<CrossChainSwapResult> {
    if (onStatusUpdate) onStatusUpdate("Preparing Solana swap...");
    
    // Get quote first
    const payAmountAtomic = BigInt(Math.floor(parseFloat(payAmount) * Math.pow(10, payToken.decimals)));
    const quote = await this.getQuote(payToken, payAmountAtomic, receiveToken);
    
    if (onStatusUpdate) onStatusUpdate("Executing Solana swap...");
    
    // For demo purposes, simulate a successful swap
    // In production, this would:
    // 1. Connect to Jupiter or another Solana DEX
    // 2. Get the best route
    // 3. Execute the swap transaction
    // 4. Wait for confirmation
    
    console.log(`Demo Solana swap: ${payAmount} ${payToken.symbol} -> ${Number(quote.receiveAmount) / Math.pow(10, receiveToken.decimals)} ${receiveToken.symbol}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (onStatusUpdate) onStatusUpdate("Solana swap completed!");
    
    return {
      status: 'success',
      job_id: BigInt(Date.now()) // Mock job ID
    };
  }
}