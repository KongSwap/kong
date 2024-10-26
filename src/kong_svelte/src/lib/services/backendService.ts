import { getActor } from '$lib/stores/walletStore';
import { walletValidator } from '$lib/validators/walletValidator';

class BackendService {
  private static instance: BackendService;
  private constructor() {}

  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  //
  // CANISTER CALLS
  //

  public async getTokens(): Promise<any> {
    try {
      const actor = await getActor();
      return await actor.tokens(['']);
    } catch (error) {
      console.error('Error calling tokens method:', error);
      throw error;
    }
  }

  public async getWhoami(): Promise<any> {
    await walletValidator.requireWalletConnection();

    try {
      const actor = await getActor();
      return await actor.get_user();
    } catch (error) {
      console.error('Error calling get_user method:', error);
      throw error;
    }
  }
}

export const backendService = BackendService.getInstance();
