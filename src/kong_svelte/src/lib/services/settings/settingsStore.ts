import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { locale, loadTranslations } from "../translations/i18nConfig";
import { kongDB } from '$lib/services/db';
import type { Settings } from './types';
import { walletStore } from '../wallet/walletStore';
type SupportedLocale = 'en' | 'es';
const supportedLocales: SupportedLocale[] = ['en', 'es'];
const defaultLocale: SupportedLocale = 'en';

function getValidLocale(locale: string | null): SupportedLocale {
  if (!locale) return defaultLocale;
  return supportedLocales.includes(locale as SupportedLocale) 
    ? (locale as SupportedLocale) 
    : defaultLocale;
}

// Get initial locale
function getInitialLocale(): SupportedLocale {
  if (!browser) return defaultLocale;
  
  const storedSettings = localStorage.getItem('appSettings');
  if (storedSettings) {
    try {
      const parsed = JSON.parse(storedSettings);
      if (parsed.language?.current) {
        return getValidLocale(parsed.language.current);
      }
    } catch (e) {
      console.error('Failed to parse stored settings:', e);
    }
  }

  const browserLocale = navigator.language.split("-")[0];
  const validLocale = getValidLocale(browserLocale);
  
  // Initialize locale immediately
  locale.set(validLocale);
  loadTranslations(validLocale);
  
  return validLocale;
}

const DEFAULT_SETTINGS: Settings = {
  sound_enabled: true,
  default_language: getInitialLocale(),
  max_slippage: 2.0,
  timestamp: Date.now(),
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(DEFAULT_SETTINGS);

  async function initializeStore() {
    if (browser) {
      const walletId = get(walletStore).account?.owner;
      const dbSettings = await kongDB.settings.filter(s => s.principal_id === walletId).first();
      if (dbSettings) {
        set(dbSettings);
        locale.set(dbSettings.default_language);
        loadTranslations(dbSettings.default_language);
      } else {
        await kongDB.settings.put({
          principal_id: walletId,
          ...DEFAULT_SETTINGS,
          timestamp: Date.now()
        });
      }
    }
  }

  async function updateSetting(
    key: keyof Settings,
    value: Settings[keyof Settings]
  ) {
    update(settings => {
      const newSettings = {
        ...settings,
        [key]: value
      };
      
      if (browser) {
        kongDB.settings.put({
          ...newSettings,
          timestamp: Date.now()
        });
        
        if (key === 'default_language') {
          locale.set(value as string);
          loadTranslations(value as string);
        }
      }
      
      return newSettings;
    });
  }

  async function reset() {
    set(DEFAULT_SETTINGS);
    if (browser) {
      const walletId = get(walletStore).account?.owner;
      await kongDB.settings.put({
        principal_id: walletId,
        ...DEFAULT_SETTINGS,
        timestamp: Date.now()
      });
      locale.set(DEFAULT_SETTINGS.default_language);
      loadTranslations(DEFAULT_SETTINGS.default_language);
    }
  }

  // Initialize the store
  initializeStore();

  return {
    subscribe,
    updateSetting,
    reset,
    soundEnabled: derived({ subscribe }, $settings => $settings.sound_enabled),
    currentLanguage: derived({ subscribe }, $settings => $settings.default_language),
  };
}

export const settingsStore = createSettingsStore(); 