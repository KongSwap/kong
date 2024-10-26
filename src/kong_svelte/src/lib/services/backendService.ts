// src/kong_svelte/src/lib/services/backendService.ts
import type { ActorSubclass } from '@dfinity/agent';
import { createPNP } from '@windoge98/plug-n-play';
import { writable, type Writable } from 'svelte/store'; // Import Writable
import {
  createActor as createKongBackendActor,
  canisterId as kongBackendCanisterId,
  idlFactory as kongBackendIDL,
} from '../../../../declarations/kong_backend';
import { HttpAgent, Actor } from '@dfinity/agent';

class BackendService {
  private static instance: BackendService;
  private pnp: ReturnType<typeof createPNP> | null = null;

  public isReady = writable<boolean>(false);
  public userStore: Writable<any> = writable(null); // Add userStore

  private constructor() {
    this.initializePNP();
  }

  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  public initializePNP() {
    if (this.pnp === null && typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname.includes('localhost');
      this.pnp = createPNP({
        hostUrl: isLocalhost ? 'http://localhost:4943' : 'https://ic0.app',
        whitelist: [kongBackendCanisterId],
        identityProvider: isLocalhost
          ? 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943'
          : 'https://identity.ic0.app',
      });
    }
  }

  public async connectWallet(walletId: string): Promise<any> {
    if (!this.pnp) {
      throw new Error('PNP is not initialized.');
    }
    const account = await this.pnp.connect(walletId);

    // Verify connection
    // Fetch user data and update userStore
    if (this.pnp.isWalletConnected()) {
      await this.getWhoami();
    }

    return account;
  }

  public async disconnectWallet(): Promise<void> {
    if (!this.pnp) {
      throw new Error('PNP is not initialized.');
    }
    await this.pnp.disconnect();
    // Reset stores
    this.isReady.set(false);
    this.userStore.set(null);
  }

  public async initializeActors(): Promise<void> {
    this.isReady.set(true);
  }

  public async isConnected(): Promise<boolean> {
    if (!this.pnp) {
      return false;
    }
    return this.pnp.isWalletConnected();
  }

  private async createAuthenticatedActor(): Promise<ActorSubclass<any>> {
    if (!this.pnp || !(this.pnp.isWalletConnected())) {
      throw new Error('Wallet not connected.');
    }
    return await this.pnp.getActor(kongBackendCanisterId, kongBackendIDL);
  }

  private async createAnonymousActor(): Promise<ActorSubclass<any>> {
    const isLocalhost = window.location.hostname.includes('localhost');
    const host = isLocalhost ? 'http://localhost:4943' : 'https://ic0.app';
    const agent = HttpAgent.createSync({ host });
    if (isLocalhost) {
      await agent.fetchRootKey();
    }
    return Actor.createActor(kongBackendIDL, {
      agent,
      canisterId: kongBackendCanisterId,
    });
  }

  public async getTokens(): Promise<any> {
    try {
      const isConnected = this.pnp.isWalletConnected()
      console.log('Is wallet connected:', isConnected);
      const actor = isConnected
        ? await this.createAuthenticatedActor()
        : await this.createAnonymousActor();
      return await actor.tokens(['']);
    } catch (error) {
      console.error('Error calling tokens method:', error);
      throw error;
    }
  }

  public async getWhoami(): Promise<any> {
    try {
      const isConnected = this.pnp.isWalletConnected()
      if (!isConnected) {
        throw new Error('Wallet not connected.');
      }
      const actor = await this.createAuthenticatedActor();
      const user = await actor.get_user();
      this.userStore.set(user); // Update userStore
      return user;
    } catch (error) {
      console.error('Error calling get_user method:', error);
      throw error;
    }
  }
}

export const backendService = BackendService.getInstance();
