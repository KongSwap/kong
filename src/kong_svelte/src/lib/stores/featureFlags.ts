import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

interface FeatureFlags {
  newSwapArchitecture: boolean;
}

// Default feature flags
const defaultFlags: FeatureFlags = {
  newSwapArchitecture: false, // Set to true to enable new architecture
};

// Create the store
function createFeatureFlagsStore() {
  const { subscribe, set, update } = writable<FeatureFlags>(defaultFlags);

  // Load from localStorage if available
  if (browser) {
    const stored = localStorage.getItem('kongswap-feature-flags');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        set({ ...defaultFlags, ...parsed });
      } catch (e) {
        console.error('Failed to parse feature flags:', e);
      }
    }
  }

  return {
    subscribe,
    toggle: (flag: keyof FeatureFlags) => {
      update(flags => {
        const newFlags = { ...flags, [flag]: !flags[flag] };
        if (browser) {
          localStorage.setItem('kongswap-feature-flags', JSON.stringify(newFlags));
        }
        return newFlags;
      });
    },
    enable: (flag: keyof FeatureFlags) => {
      update(flags => {
        const newFlags = { ...flags, [flag]: true };
        if (browser) {
          localStorage.setItem('kongswap-feature-flags', JSON.stringify(newFlags));
        }
        return newFlags;
      });
    },
    disable: (flag: keyof FeatureFlags) => {
      update(flags => {
        const newFlags = { ...flags, [flag]: false };
        if (browser) {
          localStorage.setItem('kongswap-feature-flags', JSON.stringify(newFlags));
        }
        return newFlags;
      });
    },
    reset: () => {
      set(defaultFlags);
      if (browser) {
        localStorage.removeItem('kongswap-feature-flags');
      }
    }
  };
}

export const featureFlags = createFeatureFlagsStore();

// Derived store for easy access to specific flags
export const newSwapEnabled = derived(
  featureFlags,
  $flags => $flags.newSwapArchitecture
);