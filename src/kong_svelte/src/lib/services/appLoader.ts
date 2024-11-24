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

  private async preloadTokenLogos(): Promise<void> {
    try {
      const tokens = get(tokenStore);
      if (!tokens?.tokens?.length) return;

      // Update loading state with token logos
      this.loadingState.update(state => ({
        ...state,
        totalAssets: state.totalAssets + tokens.tokens.length
      }));

      // Preload default token logos first
      const defaultLogos = Object.values(DEFAULT_LOGOS);
      await Promise.all(defaultLogos.map(logo => 
        this.preloadAsset(logo, 'image', 'high')
      ));

      // Then preload other token logos
      for (const token of tokens.tokens) {
        try {
          if (!token?.canister_id) continue;
          
          const logo = await getTokenLogo(token.canister_id);
          if (logo && !this.shouldSkipPreload(logo)) {
            await this.preloadAsset(logo, 'image', 'low');
          }
        } catch (error) {
          console.warn(`Failed to preload logo for token ${token.canister_id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to preload token logos:', error);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, 'Failed to preload token logos']
      }));
    }
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized || !browser) {
      return;
    }

    this.loadingState.set({
      isLoading: true,
      assetsLoaded: 0,
      totalAssets: 0,
      errors: []
    });

    try {
      // Initialize core services
      await this.initializeWallet();
      
      // Initialize settings first
      await this.initializeSettings();

      // Load tokens with a delay to ensure DB is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      await tokenStore.loadTokens(true);
      
      // Load UI components in parallel with token operations
      const components = this.generateRequiredComponents();
      const componentPromise = Promise.all(
        components.map(component => this.preloadAsset(component, 'svg', 'high'))
      );

      // Preload token logos after tokens are loaded
      await this.preloadTokenLogos();
      
      // Wait for components to finish loading
      await componentPromise;

      // Load pools after tokens are fully loaded
      await poolStore.loadPools();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.loadingState.update(state => ({
        ...state,
        errors: [...state.errors, 'Failed to initialize app']
      }));
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