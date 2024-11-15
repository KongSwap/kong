// src/lib/services/tokens/DexieDB.ts
import Dexie, { type Table } from 'dexie';
import type { KongImage } from '$lib/services/tokens/tokenLogo';

interface FavoriteToken {
  wallet_id: string;
  canister_id: string;
  timestamp: number;
}

// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token, string>; // Table<KongImage, primary key type>
  images!: Table<KongImage, number>; // Table<KongImage, primary key type>
  favorite_tokens!: Table<FavoriteToken, string>; // Table<FavoriteToken, primary key type>

  constructor() {
    super('kong_db'); // Database name
    this.version(1).stores({
      tokens: 'canisterId, timestamp',
      images: 'canisterId, timestamp',
    });
    this.version(2).stores({
      tokens: 'canister_id, timestamp',
      images: '++id, canister_id, timestamp',
      favorite_tokens: '[canister_id+wallet_id], wallet_id, timestamp'
    }).upgrade(async tx => {
      // Get the old data
      const oldImages = await this.table('images').toArray();
      
      // Clear the table
      await this.table('images').clear();
      
      // Re-add the data with new schema
      for (const image of oldImages) {
        await this.table('images').add({
          ...image,
          timestamp: image.timestamp || Date.now()
        });
      }
    });
    this.tokens = this.table('tokens');
    this.images = this.table('images');
    this.favorite_tokens = this.table('favorite_tokens');
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