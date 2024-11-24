import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { derived, get, writable } from "svelte/store";
import { auth, canisterIDLs } from "$lib/services/auth";
import { settingsStore } from "$lib/services/settings/settingsStore";
import { assetCache } from "$lib/services/assetCache";
import { canisterId as kongBackendCanisterId } from '../../../../declarations/kong_backend';
import { getPnpInstance } from "$lib/services/pnp/PnpInitializer";
import { DEFAULT_LOGOS, IMAGE_CACHE_DURATION, fetchTokenLogo, getTokenLogo } from '$lib/services/tokens/tokenLogos';

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
  private shouldSkipPreload(url: string): boolean {
    return url.startsWith('data:image/') || url.startsWith('blob:');
  }

  private async preloadAsset(url: string, type: 'image' | 'svg' = 'image', priority: 'high' | 'low' = 'high'): Promise<void> {
    if (!browser || this.preloadedAssets.has(url) || this.shouldSkipPreload(url)) {
      return;
    }
    
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

  private async preloadTokenImages(): Promise<void> {
    try {
      // Get all tokens first
      const store = get(tokenStore);
      const tokens = store.tokens;
      
      // Fetch and preload logos for each token
      const logoPromises = tokens.map(async token => {
        try {
          // First try to get from cache using getTokenLogo
          token.logo = await getTokenLogo(token.canister_id);
          
          // If not in cache, fetch from canister and save to cache
          if (!token.logo) {
            token.logo = await fetchTokenLogo(token);
          }
          
          // Only preload if it's a URL and not a base64 string
          if (token.logo && !token.logo.startsWith('data:')) {
            await this.preloadAsset(token.logo, 'image', 'high');
          }
        } catch (error) {
          console.error(`Failed to preload logo for token ${token.canister_id}:`, error);
        }
      });
      
      // Wait for all logos to be fetched and preloaded
      await Promise.all(logoPromises);
    } catch (error) {
      console.error('Error preloading token images:', error);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, 'Failed to preload token images']
      }));
    }
  }

  private async preloadTokens(): Promise<void> {
    try {
      // Load all tokens first
      const tokens = await tokenStore.loadTokens(true);
      
      // Extract and preload all token logos, filtering out base64 and blob URLs
      const logoUrls = tokens
        .map(token => token.logo)
        .filter((logo): logo is string => 
          typeof logo === 'string' && 
          logo.length > 0 && 
          !this.shouldSkipPreload(logo)
        );
      
      // Add default logos
      const allLogos = [...new Set([...Object.values(DEFAULT_LOGOS), ...logoUrls])];
      
      // Preload all logos in batches
      await this.batchPreloadAssets(allLogos, 'image', 20);
    } catch (error) {
      console.error('Error preloading tokens:', error);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, 'Failed to preload tokens']
      }));
    }
  }

  public async initialize(): Promise<void> {
    getPnpInstance();
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

      await this.initializeWallet().catch(error => {
        console.error('Wallet initialization failed:', error);
        throw error;
      });
      
      // Generate required component paths
      const svgComponents = this.generateRequiredComponents();
      const allAssets = [...this.backgrounds, ...svgComponents];
      const areCached = await assetCache.areAssetsCached(allAssets);

      if (!areCached) {
        // Start parallel loading of assets and token images
        await Promise.all([
          this.preloadTokenImages(),
          this.batchPreloadAssets(this.backgrounds, 'image', 10),
          this.batchPreloadAssets(svgComponents, 'svg', 50),
        ]);
      }

      // Initialize stores in the correct order:
      // 1. Settings (independent)
      // 2. Tokens (depends on wallet)
      // 3. Pools (depends on tokens)
      await Promise.all([
        this.initializeSettings().catch(error => {
          console.warn('Settings initialization failed:', error);
          settingsStore.initializeStore()
        }),
        this.preloadTokens().catch(error => {
          console.error('Token initialization failed:', error);
          throw error;
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
      // Wait for wallet connection first since we need it for token operations
      // Initialize tokens using auth service
      // Add your token initialization logic here
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