import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { derived, get, writable } from "svelte/store";
import { auth, canisterIDLs } from "$lib/services/auth";
import { settingsStore } from "$lib/services/settings/settingsStore";
import { assetCache } from "$lib/services/assetCache";
import { canisterId as kongBackendCanisterId } from '../../../../declarations/kong_backend';
import { getPnpInstance } from "$lib/services/pnp/PnpInitializer";
import { DEFAULT_LOGOS } from '$lib/services/tokens/tokenLogos';

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

  private defaultTokenLogos = Object.values(DEFAULT_LOGOS);

  private async getAllTokenLogos(): Promise<string[]> {
    try {
      const tokens = await tokenStore.loadTokens();
      const logos = tokens
        .map(token => token.logo)
        .filter((logo): logo is string => typeof logo === 'string' && logo.length > 0);
      return [...new Set([...this.defaultTokenLogos, ...logos])];
    } catch (error) {
      console.error('Error fetching token logos:', error);
      return this.defaultTokenLogos;
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
      
      // Load and cache required assets
      const svgComponents = this.generateRequiredComponents();
      const allAssets = [...this.backgrounds, ...svgComponents];
      const areCached = await assetCache.areAssetsCached(allAssets);

      if (!areCached) {
        // Get all token logos first
        const allTokenLogos = await this.getAllTokenLogos();
        
        // Start parallel loading of assets
        await Promise.all([
          this.batchPreloadAssets(this.backgrounds, 'image', 10),
          this.batchPreloadAssets(svgComponents, 'svg', 50),
          this.batchPreloadAssets(allTokenLogos, 'image', 20)
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