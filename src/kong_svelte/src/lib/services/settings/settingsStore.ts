import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { locale, loadTranslations } from "../translations/i18nConfig";

type SupportedLocale = 'en' | 'es';
const supportedLocales: SupportedLocale[] = ['en', 'es'];
const defaultLocale: SupportedLocale = 'en';

interface Settings {
  sound: {
    enabled: boolean;
  };
  language: {
    current: SupportedLocale;
  };
}

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
  sound: {
    enabled: true,
  },
  language: {
    current: getInitialLocale(),
  },
};

function createSettingsStore() {
  // Initialize store with settings
  const { subscribe, set, update } = writable<Settings>(DEFAULT_SETTINGS);

  // Initialize translations immediately
  if (browser) {
    const currentLocale = DEFAULT_SETTINGS.language.current;
    locale.set(currentLocale);
    loadTranslations(currentLocale);
  }

  // Update nested settings
  function updateSetting<K extends keyof Settings, SK extends keyof Settings[K]>(
    category: K,
    key: SK,
    value: Settings[K][SK]
  ) {
    update(settings => {
      const newSettings = {
        ...settings,
        [category]: {
          ...settings[category],
          [key]: value,
        },
      };
      
      if (browser) {
        localStorage.setItem('appSettings', JSON.stringify(newSettings));
        
        // Handle locale changes
        if (category === 'language' && key === 'current') {
          locale.set(value as string);
          loadTranslations(value as string);
        }
      }
      
      return newSettings;
    });
  }

  // Convenience getters
  const soundEnabled = derived({ subscribe }, $settings => $settings.sound.enabled);
  const currentLanguage = derived({ subscribe }, $settings => $settings.language.current);

  return {
    subscribe,
    updateSetting,
    reset: () => {
      set(DEFAULT_SETTINGS);
      if (browser) {
        localStorage.setItem('appSettings', JSON.stringify(DEFAULT_SETTINGS));
        locale.set(DEFAULT_SETTINGS.language.current);
        loadTranslations(DEFAULT_SETTINGS.language.current);
      }
    },
    soundEnabled,
    currentLanguage,
  };
}

export const settingsStore = createSettingsStore();

// Initialize the store
if (browser) {
  const stored = localStorage.getItem('appSettings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      settingsStore.updateSetting('language', 'current', getValidLocale(parsed.language?.current));
    } catch (e) {
      console.error('Failed to parse stored settings:', e);
    }
  }
} 