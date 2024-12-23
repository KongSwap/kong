import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { get, writable, type Readable } from "svelte/store";
import { auth } from "$lib/services/auth";
import { updateWorkerService } from "$lib/services/updateWorkerService";
import { TokenService } from "$lib/services/tokens/TokenService";

interface LoadingState {
  isLoading: boolean;
  assetsLoaded: number;
  totalAssets: number;
  errors: string[];
}

export class AppLoader {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  // Create a writable store for loading state
  private _loadingState = writable<LoadingState>({
    isLoading: true,
    assetsLoaded: 0,
    totalAssets: 0,
    errors: [],
  });

  // Expose only the readable store
  public loadingState: Readable<LoadingState> = {
    subscribe: this._loadingState.subscribe,
  };

  public updateLoadingState(partial: Partial<LoadingState>) {
    const current = get(this._loadingState);
    this._loadingState.set({
      ...current,
      ...partial,
      // Only update progress if new values are provided
      assetsLoaded: partial.assetsLoaded ?? current.assetsLoaded,
      totalAssets: partial.totalAssets ?? current.totalAssets,
    });
  }

  public async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create new initialization promise
    this.initializationPromise = (async () => {
      try {
        await this.initializeTokens();
        await this.initializeUpdateWorker();
        this.initialized = true;
      } catch (error) {
        console.error("AppLoader initialization error:", error);
        // Reset initialization state on error
        this.initialized = false;
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private async initializeTokens(): Promise<void> {
    try {
      // Initialize tokens after wallet connection
      const wallet = get(auth);
      
      // Load tokens and wait for completion
      await Promise.all([
        tokenStore.loadTokens(),
      ]);

      await poolStore.loadPools();

      // If wallet is connected, load balances
      if (wallet?.isConnected && wallet?.account?.owner) {
        await tokenStore.loadBalances(wallet.account.owner);
      }
    } catch (error) {
      console.error("Failed to initialize tokens:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Token initialization failed: ${errorMessage}`);
    }
  }

  private async initializeUpdateWorker(): Promise<void> {
    try {
      const workerInitialized = await updateWorkerService.initialize();
      if (!workerInitialized) {
        console.warn('Workers failed to initialize, running in fallback mode');
        // Optionally update loading state or show a notification
        this._loadingState.update(state => ({
          ...state,
          errors: [...state.errors, 'Background updates running in fallback mode']
        }));
      }
    } catch (error) {
      console.error("Failed to initialize worker:", error);
      // Don't throw the error - just log it and continue
      this._loadingState.update(state => ({
        ...state,
        errors: [...state.errors, 'Background updates unavailable']
      }));
    }
  }

  public destroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export const appLoader = new AppLoader();
