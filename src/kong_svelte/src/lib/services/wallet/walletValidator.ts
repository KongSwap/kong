import { auth } from '$lib/services/auth';
import { get } from 'svelte/store';

class WalletValidator {
  public static async requireWalletConnection(): Promise<void> {
    const pnp = get(auth);
    const connected = pnp.isConnected;
    if (!connected) {
      throw new Error('Wallet is not connected.');
    }
  }
}

export const walletValidator = WalletValidator;
