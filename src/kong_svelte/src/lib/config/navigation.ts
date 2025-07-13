import {
  ChartCandlestick,
  ChartScatter,
  Trophy,
  Award,
  Settings,
  Copy,
  Search,
  Droplet,
  Bell,
  Wallet,
  Coins,
  TrendingUpDown,
} from "lucide-svelte";
import type { ComponentType } from "svelte";

export type NavTabId = "swap" | "pro" | "predict" | "pools" | "more";
export type WalletTab = "notifications" | "chat" | "wallet";

export interface NavOption {
  label: string;
  description: string;
  path: string;
  icon: ComponentType;
  comingSoon?: boolean;
}

export interface NavLink {
  id: NavTabId;
  label: string;
  type: "link";
  path: string;
  mobileDescription?: string;
  mobileIcon?: ComponentType;
}

export interface NavDropdown {
  id: NavTabId;
  label: string;
  type: "dropdown";
  path: string; // Default path when clicking the dropdown header
  options: NavOption[];
}

export type NavItem = NavLink | NavDropdown;

export interface NavAction {
  id: string;
  icon: ComponentType;
  label?: string;
  tooltip?: string;
  action: "navigate" | "copy" | "custom" | "toggle";
  path?: string; // For navigate actions
  showWhen?: "always" | "connected" | "disconnected" | "dev";
  badge?: "notifications" | null;
}

export interface NavigationConfig {
  desktop: {
    items: NavItem[];
    actions: NavAction[];
  };
  mobile: {
    groups: Array<{
      title: string;
      options: Array<NavOption & { path: string }>;
    }>;
    swipeGestures: {
      threshold: number;
      edgeZone: number;
    };
  };
  accessibility: {
    keyboardShortcuts: boolean;
    ariaLabels: boolean;
    focusManagement: boolean;
  };
  performance: {
    memoization: boolean;
    lazyLoading: boolean;
  };
}

export interface AccountMenuItem {
  label: string;
  icon: ComponentType;
  onClick: () => void;
  show: boolean;
  badgeCount?: number;
}

// Main navigation configuration
export const NAVIGATION_ITEMS: NavItem[] = [
  {
    id: "swap",
    label: "SWAP",
    type: "link",
    path: "/",
    mobileDescription: "Simple and intuitive token swapping interface",
    mobileIcon: Wallet
  },
  {
    id: "pro",
    label: "PRO",
    type: "link",
    path: "/pro",
    mobileDescription: "Advanced trading features with detailed market data",
    mobileIcon: Coins
  },
  {
    id: "predict",
    label: "PREDICT",
    type: "link",
    path: "/predict",
    mobileDescription: "Trade on future outcomes",
    mobileIcon: TrendingUpDown
  },
  {
    id: "pools",
    label: "POOLS",
    type: "link",
    path: "/pools",
    mobileDescription: "Provide liquidity and earn rewards",
    mobileIcon: Droplet
  },
  {
    id: "more",
    label: "MORE",
    type: "dropdown",
    path: "/stats", // Default path
    options: [
      {
        label: "Tokens",
        description: "View general statistics and platform metrics",
        path: "/stats",
        icon: ChartCandlestick
      },
      {
        label: "Bubbles",
        description: "Visualize token price changes with bubbles",
        path: "/stats/bubbles",
        icon: ChartScatter
      },
      {
        label: "Leaderboards",
        description: "View trading leaderboards",
        path: "/stats/leaderboard",
        icon: Trophy
      },
      {
        label: "Airdrop Claims",
        description: "Claim your airdrop tokens",
        path: "/airdrop-claims",
        icon: Award
      }
    ]
  }
];

// Enhanced action buttons configuration with proper grouping
export const ACTION_BUTTONS: NavAction[] = [
  {
    id: "settings",
    icon: Settings,
    tooltip: "Settings",
    action: "navigate",
    path: "/settings",
    showWhen: "always"
  },
  {
    id: "search",
    icon: Search,
    tooltip: "Search",
    action: "custom",
    showWhen: "always"
  },
  {
    id: "faucet",
    icon: Droplet,
    tooltip: "Claim test tokens",
    action: "custom",
    showWhen: "dev"
  },
  {
    id: "copy-principal",
    icon: Copy,
    tooltip: "Copy Principal ID",
    action: "copy",
    showWhen: "connected"
  },
  {
    id: "copy-account",
    icon: Copy,
    label: "Copy Account ID",
    action: "copy",
    showWhen: "connected"
  },
  {
    id: "notifications",
    icon: Bell,
    label: "Notifications",
    action: "toggle",
    showWhen: "always",
    badge: "notifications"
  },
  {
    id: "wallet",
    icon: Wallet,
    action: "toggle",
    showWhen: "always",
    badge: "notifications"
  }
];

// Desktop-specific action buttons (filtered for desktop display)
export const DESKTOP_ACTION_BUTTONS = ACTION_BUTTONS.filter(
  button => !['copy-account', 'notifications'].includes(button.id)
);

// Mobile-specific action buttons (essential actions only)
export const MOBILE_ACTION_BUTTONS = ACTION_BUTTONS.filter(
  button => ['search', 'copy-principal', 'wallet'].includes(button.id)
);

// Mobile navigation groups (derived from main config with enhanced logic)
export function getMobileNavGroups() {
  const groups: Array<{
    title: string;
    options: Array<NavOption & { path: string }>;
  }> = [];

  NAVIGATION_ITEMS.forEach(item => {
    if (item.type === "link") {
      // Group single links by their category with better organization
      const groupTitle = item.id === "pro" ? "SWAP" : item.id.toUpperCase();
      const existingGroup = groups.find(g => g.title === groupTitle);
      
      if (existingGroup) {
        existingGroup.options.push({
          label: item.label,
          description: item.mobileDescription || "",
          path: item.path,
          icon: item.mobileIcon || Wallet
        });
      } else {
        groups.push({
          title: groupTitle,
          options: [{
            label: item.label,
            description: item.mobileDescription || "",
            path: item.path,
            icon: item.mobileIcon || Wallet
          }]
        });
      }
    } else if (item.type === "dropdown") {
      groups.push({
        title: item.label,
        options: item.options
      });
    }
  });

  // Merge SWAP and PRO into a single SWAP group
  const swapGroup = groups.find(g => g.title === "SWAP");
  const proGroup = groups.find(g => g.title === "PRO");
  
  if (swapGroup && proGroup) {
    swapGroup.options.push(...proGroup.options);
    groups.splice(groups.indexOf(proGroup), 1);
  }

  return groups;
}

// Helper to get active tab from path
export function getActiveTabFromPath(path: string): NavTabId | null {
  if (path === "/") return "swap";
  
  const firstSegment = path.split("/")[1];
  
  // Direct matches
  const directMatches: Record<string, NavTabId> = {
    "pro": "pro",
    "predict": "predict",
    "pools": "pools",
    "stats": "more",
    "airdrop-claims": "more"
  };
  
  return directMatches[firstSegment] || null;
}

// Enhanced path to tab mapping with better coverage
export const PATH_TO_TAB_MAP: Record<string, NavTabId> = {
  "/": "swap",
  "/pro": "pro",
  "/predict": "predict",
  "/pools": "pools",
  "/airdrop-claims": "more",
  "/stats": "more",
  "/tokens": "more",
};

// Helper to check if action should be shown
export function shouldShowAction(
  action: NavAction,
  isConnected: boolean,
  isDev: boolean
): boolean {
  switch (action.showWhen) {
    case "always":
      return true;
    case "connected":
      return isConnected;
    case "disconnected":
      return !isConnected;
    case "dev":
      return isDev;
    default:
      return true;
  }
}

// Main navigation configuration object
export const NAVIGATION_CONFIG: NavigationConfig = {
  desktop: {
    items: NAVIGATION_ITEMS,
    actions: DESKTOP_ACTION_BUTTONS
  },
  mobile: {
    groups: [], // Will be populated by getMobileNavGroups()
    swipeGestures: {
      threshold: 75,
      edgeZone: 50
    }
  },
  accessibility: {
    keyboardShortcuts: true,
    ariaLabels: true,
    focusManagement: true
  },
  performance: {
    memoization: true,
    lazyLoading: false
  }
};

// Initialize mobile navigation groups
NAVIGATION_CONFIG.mobile.groups = getMobileNavGroups();

// Helper to filter actions based on platform
export function getActionsForPlatform(isMobile: boolean): NavAction[] {
  return isMobile ? MOBILE_ACTION_BUTTONS : DESKTOP_ACTION_BUTTONS;
}

// Helper to get navigation items with proper typing
export function getNavigationItems(): NavItem[] {
  return NAVIGATION_CONFIG.desktop.items;
}

// Helper to get mobile navigation groups with caching
let cachedMobileGroups: ReturnType<typeof getMobileNavGroups> | null = null;
export function getMobileNavigationGroups() {
  if (!cachedMobileGroups) {
    cachedMobileGroups = getMobileNavGroups();
  }
  return cachedMobileGroups;
}