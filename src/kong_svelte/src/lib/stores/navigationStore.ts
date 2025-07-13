import { writable, derived, get } from "svelte/store";
import type { NavTabId, WalletTab } from "$lib/config/navigation";
import { getActiveTabFromPath } from "$lib/config/navigation";
import { page } from "$app/stores";
import { notificationsStore } from "./notificationsStore";
import { navigationState, createNavigationStore } from "$lib/state/navigation.state.svelte";

/**
 * Legacy navigation store - maintained for backward compatibility
 * New code should use navigationState from $lib/state/navigation.state.svelte
 * @deprecated Use navigationState instead
 */

interface LegacyNavigationState {
  mobileMenuOpen: boolean;
  activeDropdown: NavTabId | null;
  walletSidebarOpen: boolean;
  walletSidebarTab: WalletTab;
}

function createLegacyNavigationStore() {
  console.warn("navigationStore is deprecated. Please migrate to navigationState from $lib/state/navigation.state.svelte");
  
  // Create a bridge to the new state management system
  return createNavigationStore();
}

// Create the legacy store instance (bridged to new system)
export const navigationStore = createLegacyNavigationStore();

// Export the modern state system for new code
export { navigationState } from "$lib/state/navigation.state.svelte";

// Derived store for active tab based on current route
export const activeNavTab = derived(
  [page],
  ([$page]) => {
    if (!$page) return null;
    return getActiveTabFromPath($page.url.pathname);
  }
);