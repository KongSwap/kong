import { writable, derived, get } from "svelte/store";
import { browser } from "$app/environment";
import { kongDB } from '$lib/services/db';
import type { Settings } from './types';
import { auth } from '../auth';

const DEFAULT_SETTINGS: Settings = {
  sound_enabled: false,
  max_slippage: 2.0,
  timestamp: Date.now(),
};

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
        const dbSettings = await kongDB.settings.get(walletId);
        if (dbSettings) {
          // Ensure max_slippage is set when loading from DB
          set({
            ...DEFAULT_SETTINGS, // Start with defaults
            ...dbSettings, // Override with DB settings
            max_slippage: dbSettings.max_slippage ?? DEFAULT_SETTINGS.max_slippage // Ensure max_slippage has a value
          });
        } else {
          // If no settings exist, store default settings
          await kongDB.settings.put({
            ...DEFAULT_SETTINGS,
            principal_id: walletId,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Error initializing settings:', error);
      }
    }
  }

  async function updateSetting(
    key: keyof Settings,
    value: Settings[keyof Settings],
  ) {
    update(settings => {
      const walletId = get(auth).account?.owner?.toString();
      if (!walletId) {
        console.error('Wallet ID is not available.');
        return settings;
      }

      const newSettings = {
        ...settings,
        [key]: value,
      };

      if (browser) {
        try {
          kongDB.settings.put({
            ...newSettings,
            principal_id: walletId,
            timestamp: Date.now(),
          });

        } catch (error) {
          console.error("Error updating settings:", error);
        }
      }

      return newSettings;
    });
  }

  async function reset() {
    const walletId = get(auth).account?.owner;
    if (!walletId) {
      console.error('Wallet ID is not available.');
      return;
    }

    set(DEFAULT_SETTINGS);
    
    if (browser) {
      await kongDB.settings.put({
        ...DEFAULT_SETTINGS,
        principal_id: walletId,
        timestamp: Date.now(),
      });
    }
  }

  return {
    subscribe,
    set,
    initializeStore,
    updateSetting,
    reset,
    soundEnabled: derived(
      { subscribe },
      ($settings) => $settings.sound_enabled ?? DEFAULT_SETTINGS.sound_enabled,
    ),
    currentLanguage: derived(
      { subscribe },
      ($settings) => $settings.default_language,
    ),
  };
}

export const settingsStore = createSettingsStore();
