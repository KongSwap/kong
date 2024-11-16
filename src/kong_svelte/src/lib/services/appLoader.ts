import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { walletStore, restoreWalletConnection } from "$lib/services/wallet/walletStore";
import { derived, get } from "svelte/store";

export class AppLoader {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;

  // Create a derived store for auth state
  private authState = derived(walletStore, ($wallet) => ({
    isConnected: $wallet.isConnected,
    owner: $wallet?.account?.owner
  }));

  private unsubscribeAuth: (() => void) | null = null;

  // Asset preloading
  private async preloadAsset(url: string, type: 'image' | 'svg' = 'image'): Promise<void> {
    if (!browser) return;
    return new Promise((resolve) => {
      if (type === 'image') {
        // Use Image object for background images instead of link preload
        const img = new Image();
        img.src = url;
        img.onload = () => resolve();
      } else {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = type;
        link.href = url;
        link.onload = () => resolve();
        document.head.appendChild(link);
      }
    });
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
    }
  }

  private async executeAuthenticatedAPICalls(): Promise<void> {
    try {
      await Promise.all([
        tokenStore.loadBalances(),
        tokenStore.loadPrices()
      ]);
    } catch (error) {
      console.error("Error updating authenticated data:", error);
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

  public async initialize(assets: { backgrounds: string[], svgComponents: string[] }): Promise<void> {
    if (this.isInitialized) return;

    // Core data loading
    await restoreWalletConnection();
    
    // Load public data
    await this.executePublicAPICalls();

    // Asset preloading - separate backgrounds and SVGs
    const assetPromises = [
      ...assets.backgrounds.map(bg => this.preloadAsset(bg, 'image')),
      ...assets.svgComponents.map(svg => this.preloadAsset(svg, 'svg'))
    ];

    await Promise.all(assetPromises);

    // Setup auth state subscription
    this.unsubscribeAuth = this.authState.subscribe(async (auth) => {
      if (auth.isConnected) {
        await this.executeAuthenticatedAPICalls();
        if (!this.timeoutId) this.startPolling();
      } else {
        // Clear polling if user disconnects
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
      }
    });

    this.isInitialized = true;
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
  }
}

export const appLoader = new AppLoader();