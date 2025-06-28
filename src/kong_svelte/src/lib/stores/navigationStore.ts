import { writable, derived, get } from "svelte/store";
import type { NavTabId, WalletTab } from "$lib/config/navigation";
import { getActiveTabFromPath } from "$lib/config/navigation";
import { page } from "$app/stores";
import { notificationsStore } from "./notificationsStore";

interface NavigationState {
  mobileMenuOpen: boolean;
  activeDropdown: NavTabId | null;
  walletSidebarOpen: boolean;
  walletSidebarTab: WalletTab;
}

function createNavigationStore() {
  const initialState: NavigationState = {
    mobileMenuOpen: false,
    activeDropdown: null,
    walletSidebarOpen: false,
    walletSidebarTab: "wallet"
  };

  const { subscribe, set, update } = writable<NavigationState>(initialState);

  let dropdownCloseTimeout: ReturnType<typeof setTimeout>;

  return {
    subscribe,
    
    // Mobile menu controls
    openMobileMenu: () => update(state => ({ ...state, mobileMenuOpen: true })),
    closeMobileMenu: () => update(state => ({ ...state, mobileMenuOpen: false })),
    toggleMobileMenu: () => update(state => ({ ...state, mobileMenuOpen: !state.mobileMenuOpen })),
    
    // Dropdown controls
    showDropdown: (dropdown: NavTabId) => {
      clearTimeout(dropdownCloseTimeout);
      update(state => ({ ...state, activeDropdown: dropdown }));
    },
    hideDropdown: () => {
      dropdownCloseTimeout = setTimeout(() => {
        update(state => ({ ...state, activeDropdown: null }));
      }, 150);
    },
    
    // Wallet sidebar controls
    openWalletSidebar: (tab?: WalletTab) => {
      const unreadCount = get(notificationsStore).unreadCount;
      const defaultTab = tab || (unreadCount > 0 ? "notifications" : "wallet");
      
      update(state => ({
        ...state,
        walletSidebarOpen: true,
        walletSidebarTab: defaultTab
      }));
    },
    closeWalletSidebar: () => {
      update(state => ({
        ...state,
        walletSidebarOpen: false
      }));
    },
    toggleWalletSidebar: (tab?: WalletTab) => {
      update(state => {
        if (!state.walletSidebarOpen) {
          const unreadCount = get(notificationsStore).unreadCount;
          const defaultTab = tab || (unreadCount > 0 ? "notifications" : "wallet");
          return {
            ...state,
            walletSidebarOpen: true,
            walletSidebarTab: defaultTab
          };
        } else if (tab && tab !== state.walletSidebarTab) {
          // If sidebar is open but different tab requested, switch tabs
          return {
            ...state,
            walletSidebarTab: tab
          };
        } else {
          // Close sidebar
          return {
            ...state,
            walletSidebarOpen: false
          };
        }
      });
    },
    setWalletTab: (tab: WalletTab) => {
      update(state => ({ ...state, walletSidebarTab: tab }));
    },
    
    // Reset state
    reset: () => set(initialState)
  };
}

// Create the store instance
export const navigationStore = createNavigationStore();

// Derived store for active tab based on current route
export const activeNavTab = derived(
  [page],
  ([$page]) => {
    if (!$page) return null;
    return getActiveTabFromPath($page.url.pathname);
  }
);