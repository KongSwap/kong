import { KONG_BACKEND_PRINCIPAL } from '$lib/constants/canisterConstants';
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

    const wallet = get(walletStore);
    if (!wallet.isConnected) {
      return null;
    }
    try {
      const result = await wallet.signerAgent.call(KONG_BACKEND_PRINCIPAL, {
        methodName: 'get_user',
        effectiveCanisterId: KONG_BACKEND_PRINCIPAL,
        arg: null,
      });
      if (result.Err) {
        throw new Error(result.Err);
      }
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
