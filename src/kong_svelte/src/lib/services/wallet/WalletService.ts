import { getActor, walletStore } from './walletStore';
import { get } from 'svelte/store';

export class WalletService {
  protected static instance: WalletService;

  public static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  public static async getWhoami(): Promise<BE.User> {

    const isWalletConnected = get(walletStore).isConnected;
    if (!isWalletConnected) {
      return null;
    }
    try {
      const actor = await getActor();
      const result = await actor.get_user();
      return result.Ok;
    } catch (error) {
      console.error('Error calling get_user method:', error);
      throw error;
    }
  }

  public static async principalId(): Promise<string> {
    return this.getWhoami().then((user) => {
      return user.principal_id;
    }).catch((error) => {
      console.error('Error getting principal id:', error);
      return null;
    });
  }
} 
