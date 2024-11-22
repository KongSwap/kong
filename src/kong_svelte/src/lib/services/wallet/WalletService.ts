import { KONG_BACKEND_PRINCIPAL } from '$lib/constants/canisterConstants';
import { auth } from '../auth';
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

  public static async getWhoami(): Promise<User> {
    const isWalletConnected = get(auth).isConnected;
    if (!isWalletConnected) {
      return null;
    }
    try {
      const actor = await auth.getActor(KONG_BACKEND_PRINCIPAL, 'kong_backend', {anon: true});
      if (!actor) {
        console.warn('No actor available for get_user call');
        return null;
      }
      const result = await actor.get_user();
      if (!result.Ok) {
        console.warn('get_user returned error:', result.Err);
        return null;
      }
      return result.Ok;
    } catch (error) {
      console.error('Error calling get_user method:', error);
      return null;
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
