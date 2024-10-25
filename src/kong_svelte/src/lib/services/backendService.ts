// src/kong_svelte/src/lib/services/backendService.ts
import type { ActorSubclass } from '@dfinity/agent';
import { createPNP } from '@windoge98/plug-n-play';
import { writable } from 'svelte/store';
import { createActor as createKongBackendActor, canisterId as kongBackendCanisterId, idlFactory as kongBackendIDL } from '../../../../declarations/kong_backend';
import { HttpAgent, Actor } from '@dfinity/agent';

interface BackendActors {
  kongBackendAnonActor: ActorSubclass<any> | null;
  kongBackendActor: ActorSubclass<any> | null;
  icrc1Actor: ActorSubclass<any> | null;
  icrc2Actor: ActorSubclass<any> | null;
}

class BackendService {
  // Singleton instance
  private static instance: BackendService;

  // Plug N Play instance
  private pnp: ReturnType<typeof createPNP> | null = null;

  // Store for backend actors
  private actors: BackendActors = {
    kongBackendAnonActor: null,
    kongBackendActor: null,
    icrc1Actor: null,
    icrc2Actor: null,
  };

  // Reactive store to indicate readiness
  public isReady = writable<boolean>(false);

  private constructor() {
    this.initializePNP();
  }

  // Get the singleton instance
  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  // Initialize Plug N Play
  public initializePNP() {
    if (this.pnp === null && typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname.includes('localhost');
      // Initialize Plug N Play with configuration
      this.pnp = createPNP({
        hostUrl: isLocalhost
        ? 'http://localhost:4943'
        : 'https://ic0.app',
        whitelist: [kongBackendCanisterId],
        identityProvider: isLocalhost
          ? 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943'
          : 'https://identity.ic0.app',
      });
    }
  }

  // **Add connectWallet method**
  public async connectWallet(walletId: string): Promise<any> {
    if (!this.pnp) {
      throw new Error('PNP is not initialized.');
    }
    // Connect to the wallet using Plug N Play
    const account = await this.pnp.connect(walletId);
    return account;
  }

  // **Add disconnectWallet method**
  public async disconnectWallet(): Promise<void> {
    if (!this.pnp) {
      throw new Error('PNP is not initialized.');
    }
    await this.pnp.disconnect();
    // Reset the actors and readiness state
    this.actors = { kongBackendAnonActor: null, kongBackendActor: null, icrc1Actor: null, icrc2Actor: null };
    this.isReady.set(false);
  }

  // Initialize actors
  public async initializeActors(): Promise<void> {
    await this.initializeAnonActors();
    await this.initializeSignedActors();
  }

  private async initializeSignedActors(): Promise<void> {
    try {
      if (!this.pnp.isWalletConnected) {
        console.warn('PNP is not initialized.');
        return;
      }
      this.actors.kongBackendActor = await this.pnp.getActor(
        kongBackendCanisterId,
        kongBackendIDL,
      );
      this.isReady.set(true);
      console.log('Backend actors are ready.');
    } catch (error) {
      console.log('Failed to initialize backend actors:', error);
    }
  }

  private async initializeAnonActors(): Promise<void> {
    try {
      this.actors.kongBackendAnonActor = createKongBackendActor(kongBackendCanisterId);
    } catch (error) {
      console.error('Failed to initialize anonymous backend actors:', error);
    }
  }

  // Get the kongBackend actor
  public get kongBackend(): ActorSubclass<any> | null {
    return this.actors.kongBackendActor;
  }

  private async kongBackendAnonActor(): Promise<ActorSubclass<any>> {
    const agent = HttpAgent.createSync({
      host: window.location.hostname.includes("localhost") ? "http://localhost:4943" : "https://ic0.app",
    });
    if (window.location.hostname.includes("localhost")) {
        await agent.fetchRootKey();
    }
    return Actor.createActor(kongBackendIDL, { canisterId: kongBackendCanisterId, agent });
  }


  // Example method to call a backend function
  public async getTokens(): Promise<any> {
    try {
      const backend = await this.kongBackendAnonActor();
      return await backend.tokens([""]);
    } catch (error) {
      console.error('Error calling tokens method:', error);
      throw error;
    }
  }
}

export const backendService = BackendService.getInstance();
