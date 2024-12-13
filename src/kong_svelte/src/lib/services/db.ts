// src/lib/services/tokens/DexieDB.ts
import Dexie, { type Table } from 'dexie';
import type { KongImage, FavoriteToken } from '$lib/services/tokens/types';
import type { Settings } from '$lib/services/settings/types';

// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token, string>; // Table<KongImage, primary key type>
  indexedTokens!: Table<FE.Token, string>; // Table<FE.Token, primary key type>
  images!: Table<KongImage, number>; // Table<KongImage, primary key type>
  favorite_tokens!: Table<FavoriteToken, string>; // Table<FavoriteToken, primary key type>
  settings!: Table<Settings, string>; // Add settings table
  pools!: Table<BE.Pool, string>;
  transactions: Table<FE.Transaction, number>;

  constructor() {
    super('kong_db'); // Database name
    
    // Increase version number for new schema
    this.version(2).stores({
      indexedTokens: 'token_id, address, canister_id',
      tokens: 'canister_id, timestamp',
      images: '++id, canister_id, timestamp',
      pools: 'id, address_0, address_1, timestamp',
      transactions: 'id',
      favorite_tokens: '[canister_id+wallet_id], wallet_id, timestamp',
      settings: 'principal_id, timestamp'
    });

    // Add upgrade logic
    this.version(2).upgrade(tx => {
      return tx.tokens.toCollection().modify(token => {
        if (!token.timestamp) token.timestamp = Date.now();
      });
    });

    this.tokens = this.table('tokens');
    this.indexedTokens = this.table('indexedTokens');
    this.images = this.table('images');
    this.pools = this.table('pools');
    this.favorite_tokens = this.table('favorite_tokens');
    this.settings = this.table('settings');
    this.transactions = this.table('transactions');

    // Set up periodic cache cleanup
    this.setupCacheCleanup();
  }

  private async setupCacheCleanup() {
    // Clean up old cached data every hour
    setInterval(async () => {
      const ONE_HOUR = 60 * 60 * 1000;
      const now = Date.now();
      
      try {
        // Delete tokens older than 1 hour
        await this.tokens
          .where('timestamp')
          .below(now - ONE_HOUR)
          .delete();

        // Delete pools older than 1 hour
        await this.pools
          .where('timestamp')
          .below(now - ONE_HOUR)
          .delete();

        // Delete images older than 24 hours
        await this.images
          .where('timestamp')
          .below(now - 24 * ONE_HOUR)
          .delete();

        console.log('Cache cleanup completed');
      } catch (error) {
        console.error('Error during cache cleanup:', error);
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

// Initialize the database instance
export const kongDB = new KongDB();

// Add hooks for data consistency
kongDB.tokens.hook('creating', (primKey, token) => {
  token.timestamp = Date.now();
  return token;
});

kongDB.tokens.hook('updating', (modifications, primKey, token) => {
  modifications.timestamp = Date.now();
  return modifications;
});

kongDB.pools.hook('creating', (primKey, pool) => {
  pool.timestamp = Date.now();
  return pool;
});

kongDB.pools.hook('updating', (modifications, primKey, pool) => {
  modifications.timestamp = Date.now();
  return modifications;
});

kongDB.tokens.hook('deleting', (primKey, token) => {
  // When deleting a token, also delete its image and remove it from pools
  return Promise.all([
    kongDB.images.where('canister_id').equals(token.canister_id).delete()
  ]);
});