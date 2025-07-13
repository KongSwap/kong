/**
 * Modern Svelte 5 Navigation State Management
 * Replaces the legacy navigationStore.ts with runes-based state
 */

import type { NavTabId, WalletTab } from "$lib/config/navigation";
import { getActiveTabFromPath, PATH_TO_TAB_MAP } from "$lib/config/navigation";
import { notificationsStore } from "$lib/stores/notificationsStore";
import { get } from "svelte/store";

export interface NavigationState {
  readonly mobileMenuOpen: boolean;
  readonly activeDropdown: NavTabId | null;
  readonly walletSidebarOpen: boolean;
  readonly walletSidebarTab: WalletTab;
  readonly isTransitioning: boolean;
}

class NavigationStateManager {
  // Private state using Svelte 5 runes
  private _mobileMenuOpen = $state(false);
  private _activeDropdown = $state<NavTabId | null>(null);
  private _walletSidebarOpen = $state(false);
  private _walletSidebarTab = $state<WalletTab>("wallet");
  private _isTransitioning = $state(false);

  // Dropdown close timeout management
  private dropdownCloseTimeout: ReturnType<typeof setTimeout> | null = null;

  // Public getters
  get mobileMenuOpen(): boolean {
    return this._mobileMenuOpen;
  }

  get activeDropdown(): NavTabId | null {
    return this._activeDropdown;
  }

  get walletSidebarOpen(): boolean {
    return this._walletSidebarOpen;
  }

  get walletSidebarTab(): WalletTab {
    return this._walletSidebarTab;
  }

  get isTransitioning(): boolean {
    return this._isTransitioning;
  }

  // Combined state getter for compatibility
  get state(): NavigationState {
    return {
      mobileMenuOpen: this._mobileMenuOpen,
      activeDropdown: this._activeDropdown,
      walletSidebarOpen: this._walletSidebarOpen,
      walletSidebarTab: this._walletSidebarTab,
      isTransitioning: this._isTransitioning
    };
  }

  // Mobile menu controls
  openMobileMenu(): void {
    this._mobileMenuOpen = true;
  }

  closeMobileMenu(): void {
    this._mobileMenuOpen = false;
  }

  toggleMobileMenu(): void {
    this._mobileMenuOpen = !this._mobileMenuOpen;
  }

  // Dropdown controls with improved timeout management
  showDropdown(dropdown: NavTabId): void {
    if (this.dropdownCloseTimeout) {
      clearTimeout(this.dropdownCloseTimeout);
      this.dropdownCloseTimeout = null;
    }
    this._activeDropdown = dropdown;
  }

  hideDropdown(delay: number = 150): void {
    if (this.dropdownCloseTimeout) {
      clearTimeout(this.dropdownCloseTimeout);
    }
    
    this.dropdownCloseTimeout = setTimeout(() => {
      this._activeDropdown = null;
      this.dropdownCloseTimeout = null;
    }, delay);
  }

  clearDropdownTimeout(): void {
    if (this.dropdownCloseTimeout) {
      clearTimeout(this.dropdownCloseTimeout);
      this.dropdownCloseTimeout = null;
    }
  }

  // Wallet sidebar controls with smart tab selection
  openWalletSidebar(tab?: WalletTab): void {
    this._isTransitioning = true;
    
    const unreadCount = get(notificationsStore).unreadCount;
    const defaultTab = tab || (unreadCount > 0 ? "notifications" : "wallet");
    
    this._walletSidebarOpen = true;
    this._walletSidebarTab = defaultTab;
    
    // Reset transition state after animation
    setTimeout(() => {
      this._isTransitioning = false;
    }, 300);
  }

  closeWalletSidebar(): void {
    this._isTransitioning = true;
    this._walletSidebarOpen = false;
    
    setTimeout(() => {
      this._isTransitioning = false;
    }, 300);
  }

  toggleWalletSidebar(tab?: WalletTab): void {
    if (!this._walletSidebarOpen) {
      this.openWalletSidebar(tab);
    } else if (tab && tab !== this._walletSidebarTab) {
      // Switch tabs without closing
      this._walletSidebarTab = tab;
    } else {
      this.closeWalletSidebar();
    }
  }

  setWalletTab(tab: WalletTab): void {
    this._walletSidebarTab = tab;
  }

  // State reset functionality
  reset(): void {
    this._mobileMenuOpen = false;
    this._activeDropdown = null;
    this._walletSidebarOpen = false;
    this._walletSidebarTab = "wallet";
    this._isTransitioning = false;
    
    if (this.dropdownCloseTimeout) {
      clearTimeout(this.dropdownCloseTimeout);
      this.dropdownCloseTimeout = null;
    }
  }

  // Cleanup method for component unmounting
  cleanup(): void {
    if (this.dropdownCloseTimeout) {
      clearTimeout(this.dropdownCloseTimeout);
      this.dropdownCloseTimeout = null;
    }
  }
}

// Create singleton instance
export const navigationState = new NavigationStateManager();

// Active tab computation based on current route
// Note: This should be used within a component context where runes are valid
export function getActiveTabForPath(path: string): NavTabId | null {
  return getActiveTabFromPath(path);
}

// Helper to determine if a path matches a tab
export function isPathActiveForTab(path: string, tabId: NavTabId): boolean {
  const activeTab = getActiveTabFromPath(path);
  return activeTab === tabId;
}

// Performance helper - memoized path to tab resolution
const pathTabCache = new Map<string, NavTabId | null>();

export function getActiveTabCached(path: string): NavTabId | null {
  if (pathTabCache.has(path)) {
    return pathTabCache.get(path)!;
  }
  
  const result = getActiveTabFromPath(path);
  pathTabCache.set(path, result);
  
  // Clear cache when it gets too large (prevent memory leaks)
  if (pathTabCache.size > 100) {
    pathTabCache.clear();
  }
  
  return result;
}

// Migration helper - creates a store-like interface for backward compatibility
export function createNavigationStore() {
  return {
    subscribe: (callback: (state: NavigationState) => void) => {
      // Simple compatibility layer - just call with current state
      callback(navigationState.state);
      
      // Return unsubscribe function
      return () => {
        // No-op for this simplified compatibility layer
      };
    },
    
    // Proxy methods to the state manager
    openMobileMenu: () => navigationState.openMobileMenu(),
    closeMobileMenu: () => navigationState.closeMobileMenu(),
    toggleMobileMenu: () => navigationState.toggleMobileMenu(),
    showDropdown: (dropdown: NavTabId) => navigationState.showDropdown(dropdown),
    hideDropdown: () => navigationState.hideDropdown(),
    openWalletSidebar: (tab?: WalletTab) => navigationState.openWalletSidebar(tab),
    closeWalletSidebar: () => navigationState.closeWalletSidebar(),
    toggleWalletSidebar: (tab?: WalletTab) => navigationState.toggleWalletSidebar(tab),
    setWalletTab: (tab: WalletTab) => navigationState.setWalletTab(tab),
    reset: () => navigationState.reset()
  };
}