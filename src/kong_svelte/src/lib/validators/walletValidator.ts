import { isConnected } from '$lib/stores/walletStore';

class WalletValidator {
  public static async requireWalletConnection(): Promise<void> {
    const connected = await isConnected();
    if (!connected) {
      throw new Error('Wallet is not connected.');
    }
  }
}

export const walletValidator = WalletValidator;
