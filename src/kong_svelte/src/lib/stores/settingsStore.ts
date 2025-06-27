import { writable, derived, get, type Writable } from "svelte/store";
import { browser } from "$app/environment";
import type { Settings } from '$lib/types/settings.ts';
import { auth } from '$lib/stores/auth';

// Default settings for new users
const DEFAULT_SETTINGS: Settings = {
  sound_enabled: false,
  ticker_enabled: false,
  max_slippage: 2.0,
  timestamp: Date.now(),
};

const SETTINGS_KEY = 'settings';

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(DEFAULT_SETTINGS);
  const initialized = writable(false);

  async function initializeStore() {
    if (!browser) return;
    
    const pnp = get(auth);
    const walletId = pnp?.account?.owner || 'default';
    
    try {
      const stored = localStorage.getItem(`${SETTINGS_KEY}_${walletId}`);
      if (stored) {
        const storedSettings = JSON.parse(stored) as Settings;
        const newSettings = {
          ...DEFAULT_SETTINGS,
          ...storedSettings,
          timestamp: storedSettings.timestamp || Date.now()
        };
        set(newSettings);
      } else {
        // Store default settings
        const defaultSettings = {
          ...DEFAULT_SETTINGS,
          timestamp: Date.now()
        };
        localStorage.setItem(`${SETTINGS_KEY}_${walletId}`, JSON.stringify(defaultSettings));
        set(defaultSettings);
      }
    } catch (error) {
      console.error('Error initializing settings:', error);
    } finally {
      initialized.set(true);
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
    initialized: { subscribe: initialized.subscribe },
    soundEnabled: derived(
      { subscribe },
      ($settings) => $settings.sound_enabled
    ),
    tickerEnabled: derived(
      { subscribe },
      ($settings) => $settings.ticker_enabled
    )
  };
}

export const settingsStore = createSettingsStore();
