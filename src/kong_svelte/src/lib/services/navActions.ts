import { get } from "svelte/store";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import { searchStore } from "$lib/stores/searchStore";
import { walletProviderStore } from "$lib/stores/walletProviderStore";
import { copyToClipboard } from "$lib/utils/clipboard";
import { faucetClaim } from "$lib/api/tokens/TokenApiClient";
import { getAccountIds } from "$lib/utils/accountUtils";
import { loadBalances } from "$lib/stores/balancesStore";
import { userTokens } from "$lib/stores/userTokens";

interface NavActionHandlers {
  navigate: (path: string) => void;
  openSearch: () => void;
  claimTokens: () => Promise<void>;
  copyPrincipalId: () => void;
  copyAccountId: () => void;
  connectWallet: () => void;
  disconnectWallet: () => Promise<void>;
}

class NavigationActionsService implements NavActionHandlers {
  private isClaiming = false;

  navigate(path: string): void {
    goto(path);
  }

  openSearch(): void {
    searchStore.open();
  }

  async claimTokens(): Promise<void> {
    if (this.isClaiming) return;
    
    this.isClaiming = true;
    try {
      await faucetClaim();
      const authState = get(auth);
      if (authState.account?.owner) {
        const tokens = get(userTokens).tokens;
        await loadBalances(tokens, authState.account.owner, true);
      }
    } finally {
      this.isClaiming = false;
    }
  }

  copyPrincipalId(): void {
    const authState = get(auth);
    const principalToCopy = authState?.account?.owner;
    if (principalToCopy) {
      copyToClipboard(principalToCopy);
    }
  }

  copyAccountId(): void {
    const authState = get(auth);
    if (authState.isConnected && authState.account?.owner) {
      const accountId = getAccountIds(
        authState.account.owner,
        authState.account.subaccount
      ).main;
      if (accountId) {
        copyToClipboard(accountId);
      }
    }
  }

  connectWallet(): void {
    walletProviderStore.open();
  }

  async disconnectWallet(): Promise<void> {
    try {
      await auth.disconnect();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  }

  // Helper method to create mobile-wrapped actions
  wrapForMobile(action: () => void | Promise<void>, onComplete?: () => void): () => void {
    return () => {
      const result = action();
      if (result instanceof Promise) {
        result.finally(() => onComplete?.());
      } else {
        onComplete?.();
      }
    };
  }

  // Check if we're in a development environment
  isDevelopment(): boolean {
    return process.env.DFX_NETWORK === "local" || 
           process.env.DFX_NETWORK === "staging";
  }
}

// Export singleton instance
export const navActions = new NavigationActionsService();