import { getActor, walletStore } from './walletStore';
import { get } from 'svelte/store';
import { Actor } from '@dfinity/agent';
import { idlFactory as kongIdl, canisterId as kongCanisterId } from '../../../../../declarations/kong_backend';

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
      const actor = Actor.createActor(kongIdl, {
        agent: wallet.signerAgent,
        canisterId: kongCanisterId
      });
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
