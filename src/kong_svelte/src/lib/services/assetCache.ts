import Dexie from 'dexie';
import { browser } from '$app/environment';

interface AssetCache {
  id: string;
  blob: Blob;
  timestamp: number;
}

class AssetCacheDatabase extends Dexie {
  assets: Dexie.Table<AssetCache, string>;

  constructor() {
    super('AssetCache');
    this.version(1).stores({
      assets: 'id,timestamp'
    });
    this.assets = this.table('assets');
  }
}

class AssetCacheService {
  private db: AssetCacheDatabase | null = null;
  private cache: Map<string, string> = new Map();
  private CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private dbInitPromise: Promise<void> | null = null;

  constructor() {
    if (browser) {
      this.dbInitPromise = this.initializeDb();
    }
  }

  private async initializeDb(): Promise<void> {
    try {
      this.db = new AssetCacheDatabase();
      // Don't block on DB count, just ensure the connection works
      this.db.assets.count().catch(error => {
        console.error('Failed to access IndexedDB:', error);
        this.db = null;
      });
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this.db = null;
    }
  }

  private async ensureDbReady(): Promise<void> {
    if (browser && this.dbInitPromise) {
      await this.dbInitPromise;
    }
  }

  private getFullUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    // Get the base URL from the current location
    const baseUrl = window.location.origin;
    // Remove any leading slash to avoid double slashes
    const cleanPath = url.startsWith('/') ? url.slice(1) : url;
    return `${baseUrl}/${cleanPath}`;
  }

  private async fetchAndCache(url: string): Promise<string> {
    if (typeof window === 'undefined') {
      return url; // Return the URL directly during SSR
    }

    try {
      // Check memory cache first
      if (this.cache.has(url)) {
        return this.cache.get(url)!;
      }

      // Get the full URL
      const fullUrl = this.getFullUrl(url);

      // Fetch the asset
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${fullUrl}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      // Store in memory cache
      this.cache.set(url, objectUrl);

      // Try to store in IndexedDB if available
      if (this.db) {
        try {
          await this.db.assets.put({ id: url, blob, timestamp: Date.now() });
        } catch (error) {
          console.warn('Failed to store asset in IndexedDB:', error);
          // Continue since we still have the memory cache
        }
      }

      return objectUrl;
    } catch (error) {
      console.error('Error fetching and caching asset:', error);
      return url; // Fallback to original URL
    }
  }

  async getAsset(url: string): Promise<string> {
    // Check memory cache first
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    try {
      // Check IndexedDB cache if available
      if (this.db && browser) {
        try {
          const cached = await this.db.assets.get(url);
          
          if (cached) {
            const age = Date.now() - cached.timestamp;
            
            if (age < this.CACHE_DURATION) {
              const objectUrl = URL.createObjectURL(cached.blob);
              this.cache.set(url, objectUrl);
              return objectUrl;
            } else {
              // Cache expired, remove it
              await this.db.assets.delete(url);
            }
          }
        } catch (error) {
          console.debug('Error accessing IndexedDB:', error);
          // Continue to fetch if IndexedDB fails
        }
      }

      // Fetch and cache if not found or expired
      return await this.fetchAndCache(url);
    } catch (error) {
      console.debug('Error getting asset:', error);
      return ''; // Return empty string for failed assets
    }
  }

  async preloadAssets(urls: string[]): Promise<void> {
    if (!browser || !this.db) {
      return;
    }

    await this.ensureDbReady();

    try {
      // Filter out duplicate URLs
      const uniqueUrls = [...new Set(urls)];
      
      // First check which assets need to be loaded
      const currentTime = Date.now();
      const existingAssets = await this.db.assets
        .where('id')
        .anyOf(uniqueUrls)
        .and(asset => currentTime - asset.timestamp < this.CACHE_DURATION)
        .toArray();

      const existingUrls = new Set(existingAssets.map(asset => asset.id));
      const urlsToLoad = uniqueUrls.filter(url => !existingUrls.has(url));

      // Load missing assets
      if (urlsToLoad.length > 0) {
        const loadPromises = urlsToLoad.map(async url => {
          try {
            const fullUrl = this.getFullUrl(url);
            const response = await fetch(fullUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch asset: ${fullUrl}`);
            }
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            
            // Store in memory cache
            this.cache.set(url, objectUrl);
            
            // Store in IndexedDB
            await this.db!.assets.put({
              id: url,
              blob,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error('Error loading asset:', url, error);
          }
        });

        await Promise.allSettled(loadPromises);
      }
    } catch (error) {
      console.error('Error preloading assets:', error);
    }
  }

  async areAssetsCached(urls: string[]): Promise<boolean> {
    if (!browser || !this.db) {
      return false;
    }

    await this.ensureDbReady();

    if (!urls?.length) {
      return true; // Return true for empty arrays since there's nothing to cache
    }

    const uniqueUrls = [...new Set(urls)];
    const currentTime = Date.now();

    try {
      // First check memory cache
      const allInMemoryCache = uniqueUrls.every(url => this.cache.has(url));

      if (allInMemoryCache) {
        return true;
      }

      // Check IndexedDB cache
      const cachedAssets = await this.db.assets
        .where('id')
        .anyOf(uniqueUrls)
        .and(asset => currentTime - asset.timestamp < this.CACHE_DURATION)
        .toArray();
      
      return cachedAssets.length === uniqueUrls.length;
    } catch (error) {
      console.error('Error checking cached assets:', error);
      return false;
    }
  }

  async clearCache(): Promise<void> {
    // Clear memory cache
    for (const objectUrl of this.cache.values()) {
      URL.revokeObjectURL(objectUrl);
    }
    this.cache.clear();

    // Clear IndexedDB cache if available
    if (this.db) {
      try {
        await this.db.assets.clear();
      } catch (error) {
        console.error('Error clearing IndexedDB cache:', error);
      }
    }
  }
}

export const assetCache = new AssetCacheService();
