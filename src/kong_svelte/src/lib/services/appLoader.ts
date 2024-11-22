import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { derived, get, writable } from "svelte/store";
import { auth, canisterIDLs, userStore } from "$lib/services/auth";
import { settingsStore } from "$lib/services/settings/settingsStore";
import { assetCache } from "$lib/services/assetCache";
import { canisterId as kongBackendCanisterId } from '../../../../declarations/kong_backend';

export class AppLoader {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private preloadedAssets = new Set<string>();
  private pendingAssets = new Set<string>();
  private loadingErrors: string[] = [];

  // Enhanced loading state store
  public loadingState = writable({ 
    isLoading: true,
    assetsLoaded: 0,
    totalAssets: 0,
    errors: [] as string[]
  });

  constructor() {
    if (browser) {
      // Subscribe to auth store changes
      userStore.subscribe((user) => {
        if (user && !this.isInitialized) {
          this.initialize().catch(console.error);
        }
      });
    }
  }

  private async initializeWallet(): Promise<void> {
    try {
      // Initialize wallet connection using auth service
      // Add your wallet initialization logic here
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, 'Failed to initialize wallet']
      }));
    }
  }

  // Asset preloading with priority, batching, and tracking
  private async preloadAsset(url: string, type: 'image' | 'svg' = 'image', priority: 'high' | 'low' = 'high'): Promise<void> {
    if (!browser || this.preloadedAssets.has(url)) return;
    
    this.pendingAssets.add(url);
    this.loadingState.update(state => ({
      ...state,
      totalAssets: this.pendingAssets.size
    }));
  
    try {
      // Use assetCache to load and cache the asset
      await assetCache.getAsset(url);
      
      this.preloadedAssets.add(url);
      this.pendingAssets.delete(url);
      
      this.loadingState.update(state => ({
        ...state,
        assetsLoaded: this.preloadedAssets.size,
        totalAssets: this.pendingAssets.size + this.preloadedAssets.size
      }));
    } catch (error) {
      console.error(`Failed to preload asset ${url}:`, error);
      this.loadingErrors.push(`Failed to load ${url}`);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, `Failed to load ${url}`]
      }));
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('App already initialized');
      return;
    }

    try {
      console.log('Starting app initialization...');
      this.loadingState.set({
        isLoading: true,
        assetsLoaded: 0,
        totalAssets: 0,
        errors: []
      });

      // Initialize stores in the correct order:
      // 1. Settings (independent)
      // 2. Tokens (depends on wallet)
      // 3. Pools (depends on tokens)
      await Promise.all([
        this.initializeSettings().catch(error => {
          console.warn('Settings initialization failed:', error);
          settingsStore.initializeStore()
        }),
        this.initializeTokens().catch(error => {
          console.error('Token initialization failed:', error);
          throw error;
        })
      ]);

      await this.initializePools().catch(error => {
        console.error('Pool initialization failed:', error);
        throw error;
      });

      console.log('App initialization complete');
      this.isInitialized = true;
    } catch (error) {
      console.error('Error during initialization:', error);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, `Initialization failed: ${error.message}`]
      }));
      throw error;
    } finally {
      this.loadingState.update(state => ({
        ...state,
        isLoading: false
      }));
    }
  }

  private async initializeTokens(): Promise<void> {
    try {
      // Wait for wallet connection first since we need it for token operations
      // Initialize tokens using auth service
      // Add your token initialization logic here
      const pnp = get(auth);
      tokenStore.loadPrices()
      tokenStore.loadTokens();
    } catch (error) {
      console.error('Failed to initialize tokens:', error);
      throw new Error(`Token initialization failed: ${error.message}`);
    }
  }

  private async initializePools(): Promise<void> {
    try {
      // Wait for tokens to be loaded since pools depend on token information
      // Initialize pools using auth service
      // Add your pool initialization logic here
      const pnp = get(auth);
      poolStore.loadPools();
      poolStore.loadUserPoolBalances();
    } catch (error) {
      console.error('Failed to initialize pools:', error);
      throw new Error(`Pool initialization failed: ${error.message}`);
    }
  }

  private async initializeSettings(): Promise<void> {
    try {
      console.log('Initializing settings...');
      const kongBackendActor = await auth.getActor(kongBackendCanisterId, canisterIDLs.kong_backend, { anon: true });
      // Initialize settings using the actor
      // Add your settings initialization logic here
      console.log('Settings initialized successfully');
    } catch (error) {
      console.error('Settings initialization error:', error);
      throw error;
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