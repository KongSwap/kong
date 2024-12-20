import Dexie from 'dexie';
import { browser } from '$app/environment';

interface AssetCache {
  id: string;
  blob: Blob;
  timestamp: number;
  objectUrl?: string;
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
  private static instance: AssetCacheService;
  private db: AssetCacheDatabase | null = null;
  private CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private dbInitPromise: Promise<void> | null = null;
  private cache: Map<string, string> = new Map();
  private initRetries = 0;
  private readonly MAX_RETRIES = 3;

  private constructor() {
    if (browser) {
      this.dbInitPromise = this.initializeDb();
    }
  }

  public static getInstance(): AssetCacheService {
    if (!AssetCacheService.instance) {
      AssetCacheService.instance = new AssetCacheService();
    }
    return AssetCacheService.instance;
  }

  private async initializeDb(): Promise<void> {
    if (!browser) return;

    try {
      // Chrome workaround: Delete database if it exists and we're retrying
      if (this.initRetries > 0) {
        try {
          await Dexie.delete('AssetCache');
          console.log('Successfully deleted corrupted database');
        } catch (deleteError) {
          console.warn('Failed to delete database:', deleteError);
        }
      }

      // Create and open database
      this.db = new AssetCacheDatabase();
      
      // Chrome workaround: Catch UnknownError specifically
      try {
        await this.db.open();
      } catch (error: any) {
        if (error?.name === 'UnknownError' && this.initRetries < this.MAX_RETRIES) {
          this.initRetries++;
          console.log(`Retrying database initialization (attempt ${this.initRetries}/${this.MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay before retry
          return this.initializeDb();
        }
        throw error; // Re-throw if not UnknownError or max retries reached
      }

      // Verify database is working
      await this.db.assets.count();
      this.initRetries = 0; // Reset retries on success
      console.log('Successfully initialized IndexedDB');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this.db = null;
      
      if (this.initRetries < this.MAX_RETRIES) {
        this.initRetries++;
        console.log(`Retrying database initialization (attempt ${this.initRetries}/${this.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay for other errors
        return this.initializeDb();
      } else {
        console.warn('Max retries reached for IndexedDB initialization, falling back to memory cache');
      }
    }
  }

  public async ensureDbReady(): Promise<void> {
    if (browser && this.dbInitPromise) {
      try {
        await this.dbInitPromise;
      } catch (error) {
        console.warn('Failed to initialize IndexedDB, falling back to memory cache:', error);
      }
    }
  }

  public isDbInitialized(): boolean {
    return this.db !== null && this.db.isOpen();
  }

  private isBase64Image(url: string): boolean {
    return url.startsWith('data:image/');
  }

  private isBlobUrl(url: string): boolean {
    return url.startsWith('blob:');
  }

  private shouldSkipCaching(url: string): boolean {
    return this.isBase64Image(url) || this.isBlobUrl(url);
  }

  private getFullUrl(url: string): string {
    if (url.startsWith('http') || this.shouldSkipCaching(url)) {
      return url;
    }
    const baseUrl = window.location.origin;
    const cleanPath = url.startsWith('/') ? url.slice(1) : url;
    return `${baseUrl}/${cleanPath}`;
  }

  private async fetchAndCache(url: string): Promise<string> {
    if (typeof window === 'undefined') {
      return url;
    }

    // Return base64 images and blob URLs directly without caching
    if (this.shouldSkipCaching(url)) {
      return url;
    }

    try {
      const fullUrl = this.getFullUrl(url);
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${fullUrl}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (this.db) {
        try {
          await this.db.assets.put({ 
            id: url, 
            blob, 
            timestamp: Date.now(),
            objectUrl 
          });
        } catch (error) {
          console.warn('Failed to store asset in IndexedDB:', error);
          URL.revokeObjectURL(objectUrl);
          return url;
        }
      }

      return objectUrl;
    } catch (error) {
      console.error('Error fetching and caching asset:', error);
      return url;
    }
  }

  public setAsset(url: string, content: string, type: string): void {
    this.cache.set(url, content);
    // Optionally handle type if needed
  }

  async getAsset(url: string): Promise<string> {
    // Return base64 images and blob URLs directly without caching
    if (this.shouldSkipCaching(url)) {
      return url;
    }

    try {
      if (this.db && browser) {
        await this.ensureDbReady();
        const cached = await this.db.assets.get(url);
        
        if (cached) {
          const age = Date.now() - cached.timestamp;
          
          if (age < this.CACHE_DURATION) {
            // If there's an existing objectUrl, revoke it to prevent memory leaks
            if (cached.objectUrl) {
              URL.revokeObjectURL(cached.objectUrl);
            }
            
            // Always create a fresh blob URL
            cached.objectUrl = URL.createObjectURL(cached.blob);
            cached.timestamp = Date.now(); // Update timestamp
            await this.db.assets.put(cached);
            return cached.objectUrl;
          } else {
            if (cached.objectUrl) {
              URL.revokeObjectURL(cached.objectUrl);
            }
            await this.db.assets.delete(url);
          }
        }
      }

      return await this.fetchAndCache(url);
    } catch (error) {
      console.debug('Error getting asset:', error);
      return url; // Return original URL as fallback instead of empty string
    }
  }

  async areAssetsCached(urls: string[]): Promise<boolean> {
    if (!browser || !this.db) {
      return false;
    }

    await this.ensureDbReady();

    if (!urls?.length) {
      return true;
    }

    // Filter out base64 images and blob URLs since they don't need caching
    const urlsToCheck = urls.filter(url => !this.shouldSkipCaching(url));
    
    if (!urlsToCheck.length) {
      return true; // All URLs were base64 or blobs, no need to check cache
    }

    const uniqueUrls = [...new Set(urlsToCheck)];
    const currentTime = Date.now();

    try {
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
    if (this.db) {
      try {
        const assets = await this.db.assets.toArray();
        for (const asset of assets) {
          if (asset.objectUrl) {
            URL.revokeObjectURL(asset.objectUrl);
          }
        }
        await this.db.assets.clear();
      } catch (error) {
        console.error('Error clearing IndexedDB cache:', error);
      }
    }
  }
}

export const assetCache = AssetCacheService.getInstance();
