import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { walletStore, restoreWalletConnection } from "$lib/services/wallet/walletStore";
import { derived, get, writable } from "svelte/store";
import { settingsStore } from "$lib/services/settings/settingsStore";
import { assetCache } from "$lib/services/assetCache";

export class AppLoader {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private preloadedAssets = new Set<string>();
  private pendingAssets = new Set<string>();
  private loadingErrors: string[] = [];

  // Create a derived store for auth state
  private authState = derived(walletStore, ($wallet) => ({
    isConnected: $wallet.isConnected,
    owner: $wallet?.account?.owner
  }));

  private unsubscribeAuth: (() => void) | null = null;

  // Enhanced loading state store
  public loadingState = writable({ 
    isLoading: true,
    assetsLoaded: 0,
    totalAssets: 0,
    errors: [] as string[]
  });

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
        assetsLoaded: this.preloadedAssets.size
      }));
    } catch (error) {
      const errorMsg = `Failed to preload asset: ${url}`;
      console.error(errorMsg, error);
      this.loadingErrors.push(errorMsg);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, errorMsg]
      }));
      this.pendingAssets.delete(url);
    }
  }

  private async batchPreloadAssets(assets: string[], type: 'image' | 'svg', batchSize: number = 5): Promise<void> {
    const batches = [];
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      batches.push(Promise.all(batch.map(url => this.preloadAsset(url, type))));
    }
    await Promise.all(batches);
  }

  // API polling - split into authenticated and public calls
  private async executePublicAPICalls(): Promise<void> {
    try {
      await Promise.all([
        tokenStore.loadTokens(),
        poolStore.loadPools()
      ]);
    } catch (error) {
      console.error("Error updating public data:", error);
      this.loadingErrors.push(`Error loading public data: ${error.message}`);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, `Error loading public data: ${error.message}`]
      }));
    }
  }

  private async executeAuthenticatedAPICalls(): Promise<void> {
    try {
      await Promise.all([
        tokenStore.loadBalances(),
        tokenStore.loadPrices(),
        settingsStore.initializeStore()
      ]);
    } catch (error) {
      console.error("Error updating authenticated data:", error);
      this.loadingErrors.push(`Error loading authenticated data: ${error.message}`);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, `Error loading authenticated data: ${error.message}`]
      }));
    }
  }

  private async pollData(): Promise<void> {
    const auth = get(this.authState);

    try {
      // Always fetch public data
      await this.executePublicAPICalls();

      // Only fetch authenticated data if user is connected
      if (auth.isConnected) {
        await this.executeAuthenticatedAPICalls();
      }
    } finally {
      this.timeoutId = setTimeout(() => this.pollData(), 7000);
    }
  }

  public startPolling(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.pollData();
  }

  // Component assets configuration
  private buttonSizeVariants = {
    small: ['green', 'yellow'],  // btnsmall only has green and yellow
    medium: ['blue', 'green', 'yellow'],
    big: ['blue', 'green', 'yellow']
  };

  private buttonStates = ['default', 'pressed', 'selected'];
  private mainPanelVariants = ['green', 'red'];
  private secondaryPanelVariants = ['green'];
  private panelParts = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'];

  private generateRequiredComponents(): string[] {
    const components: string[] = [];

    // Generate button components
    Object.entries(this.buttonSizeVariants).forEach(([size, variants]) =>
      variants.forEach(variant =>
        this.buttonStates.forEach(state => {
          const prefix = size === 'small' ? 'btnsmall' : size === 'big' ? 'bigbtn' : 'btn';
          components.push(
            `/pxcomponents/${prefix}-${variant}-${state}-l.svg`,
            `/pxcomponents/${prefix}-${variant}-${state}-mid.svg`,
            `/pxcomponents/${prefix}-${variant}-${state}-r.svg`
          );
        })
      )
    );

    // Add main panel components
    this.mainPanelVariants.forEach(variant => {
      this.panelParts.forEach(part => {
        components.push(`/pxcomponents/panel-${variant}-main-${part}.svg`);
      });
    });

    // Add secondary panel components (no ml/mr parts)
    this.secondaryPanelVariants.forEach(variant => {
      this.panelParts.forEach(part => {
        if (!['ml', 'mr'].includes(part)) {
          components.push(`/pxcomponents/panel-s-${variant}-${part}.svg`);
        }
      });
    });

    return components;
  }

  private backgrounds = [
    "/backgrounds/pools.webp",
    "/backgrounds/kong_jungle2.webp",
    "/backgrounds/grass.webp"
  ];

  public async initialize(assets?: { backgrounds: string[], svgComponents: string[] }): Promise<void> {
    if (this.isInitialized) return;

    this.loadingState.set({
      isLoading: true,
      assetsLoaded: 0,
      totalAssets: 0,
      errors: []
    });

    try {
      const svgComponents = assets?.svgComponents || this.generateRequiredComponents();
      const allAssets = [...this.backgrounds, ...svgComponents];
      const areCached = await assetCache.areAssetsCached(allAssets);

      // Core data loading
      // await restoreWalletConnection();

      if (!areCached) {
        // Start parallel loading of public data and assets
        const [assetLoadingPromise, publicDataPromise] = await Promise.allSettled([
          Promise.all([
            this.batchPreloadAssets(this.backgrounds, 'image', 5),
            this.batchPreloadAssets(svgComponents, 'svg', 20)
          ]),
          this.executePublicAPICalls()
        ]);

        // Handle any errors from the parallel loading
        for (const result of [publicDataPromise, assetLoadingPromise]) {
          if (result.status === 'rejected') {
            this.loadingErrors.push(`Failed to load data: ${result.reason}`);
          }
        }
      } else {
        // Just load public data if assets are cached
        await this.executePublicAPICalls();
      }

      // Update loading state with any errors
      if (this.loadingErrors.length > 0) {
        this.loadingState.update(state => ({
          ...state,
          errors: this.loadingErrors
        }));
      }

      // Start polling after assets are loaded
      this.startPolling();
      this.isInitialized = true;

      // Update final loading state
      this.loadingState.set({
        isLoading: false,
        assetsLoaded: this.preloadedAssets.size,
        totalAssets: this.preloadedAssets.size,
        errors: this.loadingErrors
      });

    } catch (error) {
      console.error('Error during initialization:', error);
      this.loadingErrors.push(`Initialization error: ${error}`);
      
      // Make sure to update loading state even on error
      this.loadingState.set({
        isLoading: false,
        assetsLoaded: this.preloadedAssets.size,
        totalAssets: this.preloadedAssets.size,
        errors: this.loadingErrors
      });
    }
  }

  public cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
    this.preloadedAssets.clear();
    this.pendingAssets.clear();
    this.loadingErrors = [];
  }
}

export const appLoader = new AppLoader();