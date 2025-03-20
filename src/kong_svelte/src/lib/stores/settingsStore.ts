import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import type { Settings } from '$lib/types/settings.ts';
import { auth } from '$lib/stores/auth';
import { STORAGE_KEYS, createNamespacedStore } from '$lib/config/localForage.config';

const DEFAULT_SETTINGS: Settings = {
  sound_enabled: false,
  max_slippage: 2.0,
  timestamp: Date.now(),
};

const SETTINGS_KEY = STORAGE_KEYS.SETTINGS;
const settingsStorage = createNamespacedStore(SETTINGS_KEY);

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(DEFAULT_SETTINGS);

  async function initializeStore() {
    if (browser) {
      const pnp = get(auth);
      const walletId = pnp?.account?.owner?.toString();
      if (!walletId) {
        console.error('Wallet ID is not available.');
        return;
      }

      try {
        const storedSettings = await settingsStorage.getItem<Settings>(`${SETTINGS_KEY}_${walletId}`);
        if (storedSettings) {
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
          await settingsStorage.setItem(`${SETTINGS_KEY}_${walletId}`, defaultSettings);
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
      const walletId = pnp?.account?.owner?.toString();
      if (!walletId) {
        console.error('Wallet ID is not available to save settings');
        return;
      }
      
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
      await settingsStorage.setItem(`${SETTINGS_KEY}_${walletId}`, currentSettings);
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  }
  
  async function reset() {
    if (!browser) return;
    
    const pnp = get(auth);
    const walletId = pnp?.account?.owner?.toString();
    if (!walletId) return;
    
    try {
      // Reset to default settings
      const defaultSettings = {
        ...DEFAULT_SETTINGS,
        timestamp: Date.now(),
      };
      
      // Save to store
      set(defaultSettings);
      
      // Save to storage
      await settingsStorage.setItem(`${SETTINGS_KEY}_${walletId}`, defaultSettings);
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
  };
}

export const settingsStore = createSettingsStore();
