// src/lib/services/tokens/DexieDB.ts
import Dexie, { type Table } from 'dexie';
import type { KongImage, FavoriteToken } from '$lib/services/tokens/types';
import type { Settings } from '$lib/services/settings/types';
import type { IndexerToken } from './indexer/api';

// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token, string>; // Table<KongImage, primary key type>
  indexedTokens!: Table<IndexerToken, string>; // Table<IndexerToken, primary key type>
  images!: Table<KongImage, number>; // Table<KongImage, primary key type>
  favorite_tokens!: Table<FavoriteToken, string>; // Table<FavoriteToken, primary key type>
  settings!: Table<Settings, string>; // Add settings table
  pools!: Table<BE.Pool, string>;
  transactions: Table<FE.Transaction, number>;

  constructor() {
    super('kong_db'); // Database name
    this.version(1).stores({
      indexedTokens: 'id, address, updatedAt',
      tokens: 'canister_id, timestamp',
      images: '++id, canister_id, timestamp',
      pools: 'id, address_0, address_1',
      transactions: 'id',
      favorite_tokens: '[canister_id+wallet_id], wallet_id, timestamp',
      settings: 'principal_id, timestamp' 
    });
    this.tokens = this.table('tokens');
    this.indexedTokens = this.table('indexedTokens');
    this.images = this.table('images');
    this.pools = this.table('pools');
    this.favorite_tokens = this.table('favorite_tokens');
    this.settings = this.table('settings');
    this.transactions = this.table('transactions')
  }
}

// Initialize the database instance
export const kongDB = new KongDB();

kongDB.tokens.hook('deleting', (primKey, token) => {
  // When deleting a token, also delete its image and remove it from pools
  return Promise.all([
    kongDB.images.where('canister_id').equals(token.canister_id).delete()
  ]);
});