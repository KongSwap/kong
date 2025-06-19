import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import type { Settings } from '$lib/types/settings.ts';
import { auth } from '$lib/stores/auth';

const DEFAULT_SETTINGS: Settings = {
  sound_enabled: false,
  ticker_enabled: true,
  max_slippage: 2.0,
  timestamp: Date.now(),
};

const SETTINGS_KEY = 'settings';

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(DEFAULT_SETTINGS);

  async function initializeStore() {
    if (browser) {
      const pnp = get(auth);
      const walletId = pnp?.account?.owner || 'default';
      // Always proceed, even for unauthenticated users

      try {
        const stored = localStorage.getItem(`${SETTINGS_KEY}_${walletId}`);
        if (stored) {
          const storedSettings = JSON.parse(stored) as Settings;
          // Ensure max_slippage is set when loading from storage
          set({
            ...DEFAULT_SETTINGS, // Start with defaults
            ...storedSettings, // Override with stored settings
            max_slippage: storedSettings.max_slippage ?? DEFAULT_SETTINGS.max_slippage // Ensure max_slippage has a value
          });
        } else {
          // If no settings exist, store default settings
          const defaultSettings = {
            ...DEFAULT_SETTINGS,
            principal_id: walletId,
            timestamp: Date.now()
          };
          localStorage.setItem(`${SETTINGS_KEY}_${walletId}`, JSON.stringify(defaultSettings));
        }
      } catch (error) {
        console.error('Error initializing settings:', error);
      }
    }
  }

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (!browser) return;
    
    try {
      const pnp = get(auth);
      const walletId = pnp?.account?.owner || 'default';
      
      update(settings => {
        const newSettings = { 
          ...settings, 
          [key]: value,
          timestamp: Date.now()
        };
        return newSettings;
      });
      
      // Get the current state to save
      let currentSettings: Settings;
      subscribe(value => (currentSettings = value))();
      
      // Save to storage
      localStorage.setItem(`${SETTINGS_KEY}_${walletId}`, JSON.stringify(currentSettings));
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  }
  
  async function reset() {
    if (!browser) return;
    
    const pnp = get(auth);
    const walletId = pnp?.account?.owner || 'default';
    
    try {
      // Reset to default settings
      const defaultSettings = {
        ...DEFAULT_SETTINGS,
        timestamp: Date.now(),
      };
      
      // Save to store
      set(defaultSettings);
      
      // Save to storage
      localStorage.setItem(`${SETTINGS_KEY}_${walletId}`, JSON.stringify(defaultSettings));
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  }

  return {
    subscribe,
    set,
    update,
    updateSetting,
    reset,
    initializeStore,
    soundEnabled: derived(
      { subscribe },
      ($settings) => $settings.sound_enabled
    ),
    tickerEnabled: derived(
      { subscribe },
      ($settings) => $settings.ticker_enabled ?? true
    ),
  };
}

export const settingsStore = createSettingsStore();
