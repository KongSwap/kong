import type { Principal } from '@dfinity/principal';
import { getActor, walletStore } from '$lib/stores/walletStore';
import { get } from 'svelte/store';
import { isConnected } from '$lib/stores/walletStore';

export class UserService {
  protected static instance: UserService;

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
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
