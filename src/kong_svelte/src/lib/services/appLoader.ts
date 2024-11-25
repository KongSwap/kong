import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { derived, get, writable, type Readable } from "svelte/store";
import { auth, canisterIDLs } from "$lib/services/auth";
import { settingsStore } from "$lib/services/settings/settingsStore";
import { assetCache } from "$lib/services/assetCache";
import { canisterId as kongBackendCanisterId } from '../../../../declarations/kong_backend';
import { getPnpInstance } from "$lib/services/pnp/PnpInitializer";
import { DEFAULT_LOGOS, IMAGE_CACHE_DURATION, fetchTokenLogo, getTokenLogo } from '$lib/services/tokens/tokenLogos';

interface LoadingState {
  isLoading: boolean;
  assetsLoaded: number;
  totalAssets: number;
  errors: string[];
}

export class AppLoader {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;
  private preloadedAssets = new Set<string>();
  private pendingAssets = new Set<string>();
  private loadingErrors: string[] = [];

  // Create a writable store for loading state
  private _loadingState = writable<LoadingState>({
    isLoading: true,
    assetsLoaded: 0,
    totalAssets: 0,
    errors: []
  });

  // Expose only the readable store
  public loadingState: Readable<LoadingState> = { subscribe: this._loadingState.subscribe };

  private updateLoadingState(partial: Partial<LoadingState>) {
    this._loadingState.update(state => ({
      ...state,
      ...partial
    }));
  }

  private async initializeWallet(): Promise<void> {
    try {
      // Initialize wallet connection using auth service
      // Add your wallet initialization logic here
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      this.updateLoadingState({
        errors: [...get(this._loadingState).errors, 'Failed to initialize wallet']
      });
    }
  }

  // Asset preloading with priority, batching, and tracking
  private shouldSkipPreload(url: string): boolean {
    return url.startsWith('data:image/') || url.startsWith('blob:');
  }

  private async preloadAsset(url: string, type: 'image' | 'svg' = 'image', priority: 'high' | 'low' = 'high'): Promise<void> {
    if (!browser || this.preloadedAssets.has(url) || this.shouldSkipPreload(url)) {
      return;
    }
    
    this.pendingAssets.add(url);
    this.updateLoadingState({
      totalAssets: this.pendingAssets.size
    });
  
    try {
      // Use assetCache to load and cache the asset
      const assetUrl = await assetCache.getAsset(url);
      
      // Create a promise that resolves when the image is actually loaded
      if (type === 'image') {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(undefined);
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = assetUrl;
        });
      }
      
      this.preloadedAssets.add(url);
      this.pendingAssets.delete(url);
      
      this.updateLoadingState({
        assetsLoaded: this.preloadedAssets.size,
        totalAssets: this.pendingAssets.size + this.preloadedAssets.size
      });
    } catch (error) {
      console.error(`Failed to preload asset ${url}:`, error);
      this.loadingErrors.push(`Failed to load ${url}`);
      this.updateLoadingState({
        errors: [...get(this._loadingState).errors, `Failed to load ${url}`]
      });
    }
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

  private async preloadTokenLogos(): Promise<void> {
    try {
      const tokens = get(tokenStore);
      if (!tokens?.tokens?.length) return;

      // Update loading state with token logos
      this.updateLoadingState({
        totalAssets: get(this._loadingState).totalAssets + tokens.tokens.length
      });

      // Create a batch of promises for all logo loading operations
      const logoPromises = [];

      // Add default logos to the batch
      const defaultLogos = Object.values(DEFAULT_LOGOS);
      logoPromises.push(...defaultLogos.map(logo => 
        this.preloadAsset(logo, 'image', 'high')
      ));

      // Add token logos to the batch
      for (const token of tokens.tokens) {
        if (!token?.canister_id) continue;
        
        // Create a promise that resolves when the logo is loaded
        const logoPromise = (async () => {
          const logo = await getTokenLogo(token.canister_id);
          if (logo && !this.shouldSkipPreload(logo)) {
            await this.preloadAsset(logo, 'image', 'low');
          }
        })();
        
        // Add error handling wrapper that won't reject the Promise.all
        logoPromises.push(
          logoPromise.catch(error => {
            console.warn(`Failed to preload logo for token ${token.canister_id}:`, error);
          })
        );
      }

      // Wait for all logo loading operations to complete
      await Promise.all(logoPromises);

    } catch (error) {
      console.error('Failed to preload token logos:', error);
      this.updateLoadingState({
        errors: [...get(this._loadingState).errors, 'Failed to preload token logos']
      });
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized || !browser) return;

    try {
      this.updateLoadingState({
        isLoading: true,
        assetsLoaded: 0,
        totalAssets: 0,
        errors: []
      });

      // Initialize core services in correct order
      await Promise.all([
        this.initializeWallet(),
        this.initializeTokens()
      ]);
      await this.preloadTokenLogos();
      
      // Start preloading UI assets
      const requiredComponents = this.generateRequiredComponents();
      const totalAssets = requiredComponents.length;
      
      this.updateLoadingState({
        totalAssets
      });

      // Preload assets in batches
      await this.batchPreloadAssets(requiredComponents, 'svg', 40);
      await this.batchPreloadAssets(this.backgrounds, 'image', 5);

      // Initialize remaining services
      await this.initializePools();
      await this.initializeSettings();

      // Set initialization flag
      this.isInitialized = true;
      
      // Small delay before completing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.updateLoadingState({
        isLoading: false
      });

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.updateLoadingState({
        errors: [...get(this._loadingState).errors, 'Failed to initialize app']
      });
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

  private async initializeTokens(): Promise<void> {
    try {
      // Initialize tokens after wallet connection
      const wallet = get(auth);

      // Load tokens and wait for completion
      await Promise.all([
        tokenStore.loadTokens(),
        tokenStore.loadPrices()
      ]);

      // If wallet is connected, load balances
      if (wallet?.isConnected && wallet?.account?.owner) {
        await tokenStore.loadBalances(wallet.account.owner);
      }
    } catch (error) {
      console.error('Failed to initialize tokens:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Token initialization failed: ${errorMessage}`);
    }
  }

  private async initializePools(): Promise<void> {
    try {
      // Wait for tokens to be loaded since pools depend on token information
      // Initialize pools using auth service
      // Add your pool initialization logic here
      poolStore.loadPools();
      poolStore.loadUserPoolBalances();
    } catch (error) {
      console.error('Failed to initialize pools:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Pool initialization failed: ${errorMessage}`);
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