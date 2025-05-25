import { auth } from '$lib/stores/auth';
import { createAnonymousActorHelper } from '$lib/utils/actorUtils';
import { canisters } from '$lib/config/auth.config';
import type { CanisterType } from '$lib/config/auth.config';

export class SolanaService {
  static async getActor() {
    console.log('🔍 SolanaService: Getting actor...');
    console.log('🔍 SolanaService: Is authenticated:', auth.pnp.isAuthenticated());
    console.log('🔍 SolanaService: Canister ID:', canisters.kongSolanaBackend.canisterId);
    
    if (auth.pnp.isAuthenticated()) {
      console.log('🔍 SolanaService: Creating authenticated actor...');
      return auth.pnp.getActor<CanisterType['KONG_SOLANA_BACKEND']>({
        canisterId: canisters.kongSolanaBackend.canisterId!,
        idl: canisters.kongSolanaBackend.idl,
        anon: false,
        requiresSigning: false,
      });
    } else {
      console.log('🔍 SolanaService: Creating anonymous actor...');
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
    console.log('🔍 SolanaService: Getting Kong Solana address...');
    try {
      const actor = await this.getActor();
      console.log('🔍 SolanaService: Got actor, calling get_solana_address...');
      const response = await actor.get_solana_address();
      console.log('🔍 SolanaService: get_solana_address response:', response);
      
      if ('Ok' in response) {
        console.log('✅ SolanaService: Kong Solana address:', response.Ok);
        return response.Ok;
      } else {
        console.error('❌ SolanaService: Error response:', response.Err);
        throw new Error(response.Err);
      }
    } catch (error) {
      console.error('❌ SolanaService: Error getting Kong Solana address:', error);
      throw error;
    }
  }

  /**
   * Send SOL using Phantom wallet
   */
  static async sendSolWithPhantom(
    recipientAddress: string, 
    amount: number
  ): Promise<string> {
    const adapter = auth.pnp.adapter;
    const solanaAdapter = adapter?.adapter;
    
    if (!adapter?.id?.includes('phantom')) {
      throw new Error('Phantom wallet not connected');
    }

    if (!solanaAdapter?.sendSol) {
      throw new Error('Phantom adapter does not support sending SOL');
    }

    try {
      const txSignature = await solanaAdapter.sendSol(recipientAddress, amount);
      return txSignature;
    } catch (error) {
      console.error('Failed to send SOL with Phantom:', error);
      throw new Error(`Failed to send SOL: ${error.message}`);
    }
  }

  /**
   * Get user's Solana address from connected wallet
   */
  static async getUserSolanaAddress(): Promise<string | null> {
    console.log('🔍 SolanaService: Getting user Solana address...');
    
    const adapter = auth.pnp.adapter;
    console.log('🔍 SolanaService: Current adapter:', adapter);
    console.log('🔍 SolanaService: Adapter ID:', adapter?.id);
    
    // Check if methods are on the nested adapter
    const solanaAdapter = adapter?.adapter;
    console.log('🔍 SolanaService: Nested adapter:', solanaAdapter);
    console.log('🔍 SolanaService: Nested adapter methods:', solanaAdapter ? Object.keys(solanaAdapter) : 'none');
    console.log('🔍 SolanaService: Has getSolanaAddress on nested adapter:', !!solanaAdapter?.getSolanaAddress);
    
    if (!solanaAdapter?.getSolanaAddress) {
      console.log('⚠️ SolanaService: No getSolanaAddress method available on nested adapter');
      return null;
    }

    try {
      console.log('🔍 SolanaService: Calling getSolanaAddress on nested adapter...');
      const address = await solanaAdapter.getSolanaAddress();
      console.log('✅ SolanaService: Got Solana address:', address);
      return address;
    } catch (error) {
      console.error('❌ SolanaService: Failed to get user Solana address:', error);
      return null;
    }
  }

  /**
   * Sign a message with connected Solana wallet
   */
  static async signMessage(message: string): Promise<string> {
    const adapter = auth.pnp.adapter;
    const solanaAdapter = adapter?.adapter;
    
    if (!solanaAdapter?.signMessage) {
      throw new Error('Connected wallet does not support message signing');
    }

    try {
      return await solanaAdapter.signMessage(message);
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  /**
   * Create canonical message for signing (used for swap verification)
   */
  static createCanonicalMessage(params: any): string {
    // Sort keys alphabetically for canonical ordering
    const sortedKeys = Object.keys(params).sort();
    const orderedParams: any = {};
    
    for (const key of sortedKeys) {
      orderedParams[key] = params[key];
    }
    
    return JSON.stringify(orderedParams);
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
        '1. Open your Solana wallet (Phantom, Solflare, etc.)',
        '2. Send SOL to the address below',
        '3. Wait for transaction confirmation',
        '4. Return here to complete your swap'
      ],
      address: kongAddress,
      amount
    };
  }

  /**
   * Check if current wallet supports Solana operations
   */
  static isSolanaWalletConnected(): boolean {
    const adapter = auth.pnp.adapter;
    return adapter?.id?.includes('phantom') || 
           adapter?.id?.includes('solflare') || 
           adapter?.getSolanaAddress !== undefined;
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
    console.log('🔍 SolanaService: Getting Solana capabilities...');
    
    const adapter = auth.pnp.adapter;
    const solanaAdapter = adapter?.adapter;
    console.log('🔍 SolanaService: Current adapter for capabilities:', adapter);
    console.log('🔍 SolanaService: Nested solana adapter:', solanaAdapter);
    
    const capabilities = {
      canSendSol: Boolean(solanaAdapter?.sendSol),
      canSignMessage: Boolean(solanaAdapter?.signMessage),
      canGetAddress: Boolean(solanaAdapter?.getSolanaAddress),
      walletType: adapter?.id || null
    };
    
    console.log('✅ SolanaService: Capabilities:', capabilities);
    console.log('🔍 SolanaService: Available adapter methods:', adapter ? Object.keys(adapter) : 'No adapter');
    console.log('🔍 SolanaService: Available nested adapter methods:', solanaAdapter ? Object.keys(solanaAdapter) : 'No nested adapter');
    
    return capabilities;
  }
}