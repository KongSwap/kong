export interface WalletInfo {
  id: string;
  walletName: string;
  logo: string;
  chain: string;
  googleSignIn?: string;
  recommended?: boolean;
  unsupported?: boolean;
  website?: string;
}

export interface RecentWallet {
  id: string;
  timestamp: number;
}

export interface ClickedWalletInfo {
  id: string;
  source: "recent" | "all";
}

// Chain display names mapping
export const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  ICP: "Internet Computer",
  SOL: "Solana",
  ETH: "Ethereum",
  BTC: "Bitcoin",
};

// Priority chain for sorting
export const PRIORITY_CHAIN = "Internet Computer";

// Wallet ID normalization for WalletConnect
export const WALLET_ID_MAPPINGS = {
  walletconnect: "walletconnectSiws",
  walletconnectSiws: "walletconnect",
} as const;

// Helper functions
export function normalizeWalletId(walletId: string): string {
  return walletId === "walletconnectSiws" ? "walletconnect" : walletId;
}

export function denormalizeWalletId(walletId: string): string {
  return walletId === "walletconnect" ? "walletconnectSiws" : walletId;
}

export function formatChainName(chain: string): string {
  if (!chain) return "Other";
  return CHAIN_DISPLAY_NAMES[chain] || chain;
}

export function mapRawWalletToInfo(wallet: any): WalletInfo {
  const normalizedId = normalizeWalletId(wallet.id);

  return {
    id: normalizedId,
    walletName: wallet.walletName,
    logo: wallet.logo,
    chain: wallet.chain || (wallet.id.includes("Siws") ? "SOL" : "ICP"),
    googleSignIn: wallet.id === "nfid" ? "Sign in with Google" : undefined,
    recommended: wallet.id === "oisy",
    unsupported: null,
    website: wallet.website,
  };
}

// Date formatting
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Group wallets by chain
export function groupWalletsByChain(
  wallets: WalletInfo[],
): Record<string, WalletInfo[]> {
  const grouped: Record<string, WalletInfo[]> = {};

  wallets.forEach((wallet) => {
    if (!grouped[wallet.chain]) {
      grouped[wallet.chain] = [];
    }
    grouped[wallet.chain].push(wallet);
  });

  return grouped;
}

// Sort chains by priority (Internet Computer first, then alphabetically)
export function getSortedChains(chains: string[]): string[] {
  return chains.sort((a, b) => {
    if (a === PRIORITY_CHAIN) return -1;
    if (b === PRIORITY_CHAIN) return 1;
    return a.localeCompare(b);
  });
}
