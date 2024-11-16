// src/lib/services/tokens/DexieDB.ts
import Dexie, { type Table } from 'dexie';
import type { KongImage, FavoriteToken } from '$lib/services/tokens/types';
import type { Settings } from '$lib/services/settings/types';
// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token, string>; // Table<KongImage, primary key type>
  images!: Table<KongImage, number>; // Table<KongImage, primary key type>
  favorite_tokens!: Table<FavoriteToken, string>; // Table<FavoriteToken, primary key type>
  settings!: Table<Settings, number>; // Add settings table

  constructor() {
    super('kong_db'); // Database name
    this.version(3).stores({
      tokens: 'canister_id, timestamp',
      images: '++id, canister_id, timestamp',
      favorite_tokens: '[canister_id+wallet_id], wallet_id, timestamp',
      settings: '++id, principal_id, timestamp' 
    });
    this.tokens = this.table('tokens');
    this.images = this.table('images');
    this.favorite_tokens = this.table('favorite_tokens');
    this.settings = this.table('settings');
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