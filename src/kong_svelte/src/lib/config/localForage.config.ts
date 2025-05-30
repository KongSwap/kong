import localForage from 'localforage';
import { browser } from '$app/environment';

// Configuration constants
const STORAGE_NAME = 'kongswap_storage';
const STORAGE_VERSION = 9;  // Changed from 1.1 to match existing database
const STORAGE_DESCRIPTION = 'KongSwap Local Storage';

// Storage keys/namespaces
export const STORAGE_KEYS = {
  FAVORITE_TOKENS: 'favorite_tokens',
  SETTINGS: 'settings',
  USER_TOKENS: 'user_tokens',
  ALLOWANCES: 'allowances',
  RECENT_TRADES: 'recent_trades',
  AUTH_NAMESPACE: 'auth',
  RECENT_WALLETS_NAMESPACE: 'recent_wallets',
  THEME: 'theme',
};

/**
 * Configure localForage with application-specific settings
 */
export function configureStorage() {
  if (!browser) return;

  try {
    // Configure the main storage instance
    localForage.config({
      driver: [
        localForage.INDEXEDDB,
        localForage.WEBSQL,
        localForage.LOCALSTORAGE,
      ],
      name: STORAGE_NAME,
      version: STORAGE_VERSION,
      description: STORAGE_DESCRIPTION,
      storeName: 'kong_main_store',
      size: 25600000 // 25MB
    });

    console.log('[Storage] LocalForage configured successfully');
    return true;
  } catch (error) {
    console.error('[Storage] Error configuring localForage:', error);
    return false;
  }
}

/**
 * Create a namespaced instance of localForage for a specific data type
 */
export function createNamespacedStore(namespace: string) {
  return localForage.createInstance({
    name: STORAGE_NAME,
    storeName: namespace
  });
}

/**
 * Clear all application storage data
 */
export async function clearAllStorage() {
  if (!browser) return false;
  
  try {
    await localForage.clear();
    console.log('[Storage] All localForage data cleared');
    return true;
  } catch (error) {
    console.error('[Storage] Error clearing localForage data:', error);
    return false;
  }
}

// Initialize storage when this module is imported
if (browser) {
  configureStorage();
} 