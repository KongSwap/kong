// Import polyfills first
import '$lib/utils/polyfills';

import { auth } from '$lib/stores/auth';
import { createAnonymousActorHelper } from '$lib/utils/actorUtils';
import { canisters } from '$lib/config/auth.config';
import type { CanisterType } from '$lib/config/auth.config';
import { getSolanaConnection } from '$lib/config/solana.config';

export class SolanaService {
  static async getActor() {
    if (auth.pnp.isAuthenticated()) {
      return auth.pnp.getActor<CanisterType['KONG_SOLANA_BACKEND']>({
        canisterId: canisters.kongSolanaBackend.canisterId!,
        idl: canisters.kongSolanaBackend.idl,
        anon: false,
        requiresSigning: false,
      });
    } else {
      return createAnonymousActorHelper(
        canisters.kongSolanaBackend.canisterId!,
        canisters.kongSolanaBackend.idl
      );
    }
  }

  /**
   * Get Kong's Solana address where users should send SOL/SPL tokens
   */
  static async getKongSolanaAddress(): Promise<string> {
    try {
      const actor = await this.getActor();
      const response = await actor.get_solana_address();
      
      if ('Ok' in response) {
        return response.Ok;
      } else {
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error('Failed to get Kong Solana address:', error);
      throw error;
    }
  }

  /**
   * Send SOL using connected Solana wallet
   */
  static async sendSolWithWallet(
    recipientAddress: string, 
    amount: number
  ): Promise<string> {
    const adapter = auth.pnp.adapter;
    
    if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
      throw new Error('No supported Solana wallet connected');
    }

    // Try to access the Solana wallet through window object
    let solanaWallet = null;
    
    if (adapter.id.includes('phantom')) {
      solanaWallet = (window as any).phantom?.solana || (window as any).solana;
    } else if (adapter.id.includes('solflare')) {
      solanaWallet = (window as any).solflare || (window as any).solana;
    }
    
    if (!solanaWallet) {
      throw new Error('Solana wallet not found in window object. Please make sure your wallet extension is installed and enabled.');
    }
    
    if (!solanaWallet.isConnected) {
      // Try to connect first
      try {
        await solanaWallet.connect();
      } catch (connectError) {
        throw new Error('Solana wallet is not connected and failed to connect automatically');
      }
    }

    if (!solanaWallet.publicKey) {
      throw new Error('Solana wallet public key not available');
    }

    try {
      // Import Solana web3 dynamically
      const { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      
      // Create connection to Solana mainnet using fallback RPC endpoints
      const connection = await getSolanaConnection();
      
      // Convert amount to lamports
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      
      if (lamports <= 0) {
        throw new Error('Invalid amount: must be greater than 0');
      }
      
      // Get fee estimate (Solana base fee is 5000 lamports = 0.00005 SOL)
      const feeEstimate = 5000; // 0.00005 SOL in lamports
      
      // Check if user has enough balance for amount + fee
      const balance = await connection.getBalance(new PublicKey(solanaWallet.publicKey.toString()));
      if (balance < lamports + feeEstimate) {
        const neededSOL = (lamports + feeEstimate) / LAMPORTS_PER_SOL;
        const hasSOL = balance / LAMPORTS_PER_SOL;
        throw new Error(`Insufficient balance. Need ${neededSOL.toFixed(6)} SOL (including fee), but only have ${hasSOL.toFixed(6)} SOL`);
      }
      
      // Create transfer instruction
      const fromPubkey = new PublicKey(solanaWallet.publicKey.toString());
      const toPubkey = new PublicKey(recipientAddress);
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      });
      
      // Create transaction
      const transaction = new Transaction().add(transferInstruction);
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      // Note: Solana will automatically deduct the transaction fee (0.00005 SOL) from the sender's account
      // This is in addition to the transfer amount
      
      // Sign and send transaction
      const signedTransaction = await solanaWallet.signAndSendTransaction(transaction);
      
      // Return transaction signature
      return signedTransaction.signature;
    } catch (error) {
      console.error('Failed to send SOL:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('User rejected')) {
        throw new Error('Transaction was rejected by user');
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient SOL balance');
      } else if (error.message?.includes('blockhash')) {
        throw new Error('Network error: failed to get recent blockhash');
      } else {
        throw new Error(`Failed to send SOL: ${error.message}`);
      }
    }
  }

  /**
   * Send SPL tokens using the connected wallet
   */
  static async sendSplTokenWithWallet(
    tokenMintAddress: string,
    recipientAddress: string, 
    amount: number
  ): Promise<string> {
    const adapter = auth.pnp.adapter;
    
    if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
      throw new Error('No supported Solana wallet connected');
    }

    let solanaWallet = null;
    
    if (adapter.id.includes('phantom')) {
      solanaWallet = (window as any).phantom?.solana || (window as any).solana;
    } else if (adapter.id.includes('solflare')) {
      solanaWallet = (window as any).solflare || (window as any).solana;
    }
    
    if (!solanaWallet) {
      throw new Error('Solana wallet not found');
    }
    
    if (!solanaWallet.isConnected) {
      await solanaWallet.connect();
    }

    try {
      const { PublicKey, Transaction } = await import('@solana/web3.js');
      const { 
        getAssociatedTokenAddress, 
        createTransferInstruction,
        getMint
      } = await import('@solana/spl-token');
      
      const connection = await getSolanaConnection();
      const mintPubkey = new PublicKey(tokenMintAddress);
      const fromPubkey = new PublicKey(solanaWallet.publicKey.toString());
      const toPubkey = new PublicKey(recipientAddress);
      
      // Get mint info to determine decimals
      const mintInfo = await getMint(connection, mintPubkey);
      const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, mintInfo.decimals)));
      
      // Get associated token accounts
      const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
      const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);
      
      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromPubkey,
        tokenAmount
      );
      
      // Create transaction
      const transaction = new Transaction().add(transferInstruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      // Sign and send
      const signedTransaction = await solanaWallet.signAndSendTransaction(transaction);
      return signedTransaction.signature;
    } catch (error) {
      console.error('Failed to send SPL token:', error);
      throw new Error(`Failed to send SPL token: ${error.message}`);
    }
  }

  /**
   * Get user's Solana address from connected wallet (does NOT auto-connect)
   */
  static async getUserSolanaAddress(): Promise<string | null> {
    const adapter = auth.pnp.adapter;
    
    if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
      return null;
    }

    // Try to access the Solana wallet through window object
    let solanaWallet = null;
    
    if (adapter.id.includes('phantom')) {
      solanaWallet = (window as any).phantom?.solana || (window as any).solana;
    } else if (adapter.id.includes('solflare')) {
      solanaWallet = (window as any).solflare || (window as any).solana;
    }
    
    if (!solanaWallet) {
      return null;
    }

    // Only return address if wallet is already connected
    if (!solanaWallet.isConnected || !solanaWallet.publicKey) {
      return null;
    }

    try {
      return solanaWallet.publicKey.toString();
    } catch (error) {
      console.error('Failed to get user Solana address:', error);
      return null;
    }
  }

  /**
   * Explicitly connect to Solana wallet (separate method)
   */
  static async connectSolanaWallet(): Promise<string | null> {
    const adapter = auth.pnp.adapter;
    
    if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
      throw new Error('No supported Solana wallet connected');
    }

    // Try to access the Solana wallet through window object
    let solanaWallet = null;
    
    if (adapter.id.includes('phantom')) {
      solanaWallet = (window as any).phantom?.solana || (window as any).solana;
    } else if (adapter.id.includes('solflare')) {
      solanaWallet = (window as any).solflare || (window as any).solana;
    }
    
    if (!solanaWallet) {
      throw new Error('Solana wallet not found in window object');
    }

    // Connect to wallet if not connected
    if (!solanaWallet.isConnected) {
      try {
        await solanaWallet.connect();
      } catch (error) {
        console.error('Failed to connect to Solana wallet:', error);
        throw new Error(`Failed to connect to Solana wallet: ${error.message}`);
      }
    }

    if (!solanaWallet.publicKey) {
      throw new Error('Solana wallet public key not available after connection');
    }

    try {
      return solanaWallet.publicKey.toString();
    } catch (error) {
      console.error('Failed to get user Solana address:', error);
      throw new Error(`Failed to get Solana address: ${error.message}`);
    }
  }

  /**
   * METHOD 1: Sign with Solana CLI prefix [255, "solana offchain"] + message
   */
  static async signMessageWithPrefix(message: string): Promise<string> {
    const adapter = auth.pnp.adapter;
    
    if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
      throw new Error('No supported Solana wallet connected');
    }

    let solanaWallet = null;
    
    if (adapter.id.includes('phantom')) {
      solanaWallet = (window as any).phantom?.solana || (window as any).solana;
    } else if (adapter.id.includes('solflare')) {
      solanaWallet = (window as any).solflare || (window as any).solana;
    }
    
    if (!solanaWallet?.signMessage) {
      throw new Error('Wallet does not support message signing');
    }

    const prefixText = 'solana offchain';
    const messageBytes = new TextEncoder().encode(message);
    
    // Create prefixed message: [255] + "solana offchain" + original message
    const prefixedMessage = new Uint8Array(1 + prefixText.length + messageBytes.length);
    prefixedMessage[0] = 255;
    prefixedMessage.set(new TextEncoder().encode(prefixText), 1);
    prefixedMessage.set(messageBytes, 1 + prefixText.length);
    
    console.log('🔥 METHOD 1: Signing with Solana CLI prefix');
    
    const signedMessage = await solanaWallet.signMessage(prefixedMessage);
    return this.convertSignatureToBase58(signedMessage);
  }

  /**
   * METHOD 2: Sign raw message (no prefix)
   */
  static async signMessageRaw(message: string): Promise<string> {
    const adapter = auth.pnp.adapter;
    
    if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
      throw new Error('No supported Solana wallet connected');
    }

    let solanaWallet = null;
    
    if (adapter.id.includes('phantom')) {
      solanaWallet = (window as any).phantom?.solana || (window as any).solana;
    } else if (adapter.id.includes('solflare')) {
      solanaWallet = (window as any).solflare || (window as any).solana;
    }
    
    if (!solanaWallet?.signMessage) {
      throw new Error('Wallet does not support message signing');
    }

    console.log('🔥 METHOD 2: Signing raw message (no prefix)');
    
    const messageBytes = new TextEncoder().encode(message);
    const signedMessage = await solanaWallet.signMessage(messageBytes);
    return this.convertSignatureToBase58(signedMessage);
  }

  /**
   * METHOD 3: Sign with custom prefix "Kong: " + message
   */
  static async signMessageWithCustomPrefix(message: string): Promise<string> {
    const adapter = auth.pnp.adapter;
    
    if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
      throw new Error('No supported Solana wallet connected');
    }

    let solanaWallet = null;
    
    if (adapter.id.includes('phantom')) {
      solanaWallet = (window as any).phantom?.solana || (window as any).solana;
    } else if (adapter.id.includes('solflare')) {
      solanaWallet = (window as any).solflare || (window as any).solana;
    }
    
    if (!solanaWallet?.signMessage) {
      throw new Error('Wallet does not support message signing');
    }

    console.log('🔥 METHOD 3: Signing with custom "Kong: " prefix');
    
    const customMessage = `Kong: ${message}`;
    const messageBytes = new TextEncoder().encode(customMessage);
    const signedMessage = await solanaWallet.signMessage(messageBytes);
    return this.convertSignatureToBase58(signedMessage);
  }

  /**
   * Helper: Convert wallet signature to base58 format
   */
  static convertSignatureToBase58(signedMessage: any): string {
    if (signedMessage?.signature) {
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      const bytes = new Uint8Array(signedMessage.signature);
      let result = '';
      
      let num = BigInt(0);
      for (let i = 0; i < bytes.length; i++) {
        num = num * BigInt(256) + BigInt(bytes[i]);
      }
      
      while (num > 0) {
        const remainder = Number(num % BigInt(58));
        result = base58Chars[remainder] + result;
        num = num / BigInt(58);
      }
      
      for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
        result = '1' + result;
      }
      
      return result || '1';
    } else {
      throw new Error('Invalid signature format returned from wallet');
    }
  }

  /**
   * Create canonical message for signing (used for swap verification)
   * This matches the exact format used by the shell script
   */
  static createCanonicalMessage(params: any): string {
    // Create the exact same structure as the shell script
    const messageObj = {
      pay_token: params.pay_token,
      pay_amount: parseInt(params.pay_amount), // Ensure it's a number, not string
      pay_address: params.pay_address,
      receive_token: params.receive_token,
      receive_amount: parseInt(params.receive_amount), // Ensure it's a number, not string  
      receive_address: params.receive_address,
      max_slippage: parseFloat(params.max_slippage),
      timestamp: parseInt(params.timestamp), // Ensure it's a number, not string
      referred_by: params.referred_by || null
    };
    
    // Compact JSON format (no spaces) like jq -c does
    let jsonString = JSON.stringify(messageObj);
    
    // CRITICAL: Ensure max_slippage is formatted as float (99.0) not integer (99)
    // This is necessary to match the shell script output exactly
    jsonString = jsonString.replace(
      /"max_slippage":(\d+)([,}])/,
      (match, number, suffix) => `"max_slippage":${number}.0${suffix}`
    );
    
    return jsonString;
  }

  /**
   * Request user to send SOL manually (shows instructions)
   */
  static createManualTransferInstructions(
    kongAddress: string,
    amount: number
  ): {
    title: string;
    instructions: string[];
    address: string;
    amount: number;
  } {
    return {
      title: 'Manual SOL Transfer Required',
      instructions: [
        '1. Get devnet SOL from the faucet (click the "🚰 Get Devnet SOL" button below)',
        '2. Open your Solana wallet (Phantom, Solflare, etc.)',
        '3. Send SOL to the address below',
        '4. Wait for transaction confirmation',
        '5. Return here to complete your swap'
      ],
      address: kongAddress,
      amount
    };
  }

  /**
   * Request devnet SOL from faucet
   */
  static async requestDevnetSol(walletAddress: string): Promise<string> {
    try {
      const connection = await getSolanaConnection();
      
      // Request airdrop of 1 SOL (1 billion lamports)
      const signature = await connection.requestAirdrop(
        new (await import('@solana/web3.js')).PublicKey(walletAddress),
        1000000000 // 1 SOL in lamports
      );
      
      // Confirm the transaction
      await connection.confirmTransaction(signature);
      
      return signature;
    } catch (error) {
      console.error('Failed to request devnet SOL:', error);
      throw new Error(`Failed to request devnet SOL: ${error.message}`);
    }
  }

  /**
   * Check if current wallet supports Solana operations
   */
  static isSolanaWalletConnected(): boolean {
    const adapter = auth.pnp.adapter;
    return adapter?.id?.includes('phantom') || 
           adapter?.id?.includes('solflare') || 
           (adapter as any)?.getSolanaAddress !== undefined;
  }

  /**
   * Get supported Solana operations for current wallet
   */
  static getSolanaCapabilities(): {
    canSendSol: boolean;
    canSignMessage: boolean;
    canGetAddress: boolean;
    walletType: string | null;
  } {
    try {
      const adapter = auth.pnp.adapter;
      
      if (!adapter?.id?.includes('solflare') && !adapter?.id?.includes('phantom')) {
        return {
          canSendSol: false,
          canSignMessage: false,
          canGetAddress: false,
          walletType: null
        };
      }

      // Try to access the Solana wallet through window object
      let solanaWallet = null;
      
      if (adapter.id.includes('phantom')) {
        solanaWallet = (window as any).phantom?.solana || (window as any).solana;
      } else if (adapter.id.includes('solflare')) {
        solanaWallet = (window as any).solflare || (window as any).solana;
      }
      
      if (!solanaWallet) {
        return {
          canSendSol: false,
          canSignMessage: false,
          canGetAddress: false,
          walletType: adapter?.id || null
        };
      }
      
      // Check if wallet is available and has required methods (without accessing publicKey to avoid state changes)
      const hasSignAndSend = typeof solanaWallet.signAndSendTransaction === 'function';
      const hasSignMessage = typeof solanaWallet.signMessage === 'function';
      const hasConnect = typeof solanaWallet.connect === 'function';
      const isConnected = Boolean(solanaWallet.isConnected);
      
      return {
        canSendSol: hasSignAndSend && (isConnected || hasConnect),
        canSignMessage: hasSignMessage && isConnected,
        canGetAddress: hasConnect || isConnected,
        walletType: adapter?.id || null
      };
    } catch (error) {
      console.error('Error checking Solana capabilities:', error);
      return {
        canSendSol: false,
        canSignMessage: false,
        canGetAddress: false,
        walletType: null
      };
    }
  }

  /**
   * Legacy method - tries METHOD 1 first for compatibility
   */
  static async signMessage(message: string): Promise<string> {
    return this.signMessageWithPrefix(message);
  }

  /**
   * Try all 3 signature methods and attempt swap with each
   */
  static async tryAllSignatureMethods(message: string): Promise<{ signature: string, method: string }[]> {
    const results = [];
    
    // METHOD 1: Solana CLI prefix
    try {
      const sig1 = await this.signMessageWithPrefix(message);
      results.push({ signature: sig1, method: 'prefix' });
      console.log('✅ METHOD 1 SUCCESS - Solana CLI prefix signature:', sig1.slice(0, 12) + '...');
    } catch (e) {
      console.log('❌ METHOD 1 FAILED - Solana CLI prefix:', e.message);
    }
    
    // METHOD 2: Raw message  
    try {
      const sig2 = await this.signMessageRaw(message);
      results.push({ signature: sig2, method: 'raw' });
      console.log('✅ METHOD 2 SUCCESS - Raw message signature:', sig2.slice(0, 12) + '...');
    } catch (e) {
      console.log('❌ METHOD 2 FAILED - Raw message:', e.message);
    }
    
    // METHOD 3: Custom prefix
    try {
      const sig3 = await this.signMessageWithCustomPrefix(message);
      results.push({ signature: sig3, method: 'custom' });
      console.log('✅ METHOD 3 SUCCESS - Custom prefix signature:', sig3.slice(0, 12) + '...');
    } catch (e) {
      console.log('❌ METHOD 3 FAILED - Custom prefix:', e.message);
    }
    
    return results;
  }
}