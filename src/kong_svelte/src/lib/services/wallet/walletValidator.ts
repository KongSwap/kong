import { isConnected } from '$lib/services/wallet/walletStore';

class WalletValidator {
  public static async requireWalletConnection(): Promise<void> {
    const connected = isConnected();
    if (!connected) {
      throw new Error('Wallet is not connected.');
    }
  }
}

export const walletValidator = WalletValidator;
