// src/lib/services/tokens/DexieDB.ts
import Dexie, {
  type Table,
  type Transaction,
} from "dexie";
import type { KongImage, FavoriteToken } from "$lib/services/tokens/types";
import type { Settings } from "$lib/services/settings/types";

const CURRENT_VERSION = 7;

// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token>;
  images!: Table<KongImage, number>; // Table<KongImage, primary key type>
  favorite_tokens!: Table<FavoriteToken & { id?: number }>;
  settings!: Table<Settings, string>; // Add settings table
  pools!: Table<BE.Pool, string>;
  user_pools!: Table<FE.UserPoolBalance, string>;
  pool_totals: Table<FE.PoolTotal, string>;
  transactions: Table<FE.Transaction, number>;
  allowances: Table<FE.AllowanceData, string>;
  previous_version: Table<number, string>;

  constructor() {
    super("kong_db"); // Database name

    this.version(CURRENT_VERSION - 1).stores({
      tokens: "canister_id",
      images: "++id, canister_id, timestamp",
      pools: "id, address_0, address_1, timestamp",
      user_pools: "id, address_0, address_1, timestamp",
      pool_totals: "++id, tvl, rolling_24h_volume, fees_24h, timestamp",
      transactions: "id",
      favorite_tokens: "++id, wallet_id, canister_id",
      settings: "principal_id, timestamp",
      allowances: "[address+wallet_address], wallet_address, timestamp",
      previous_version: "version",
    });

    // Increase version number and add all necessary indexes
    this.version(CURRENT_VERSION).stores({
      tokens: "canister_id, timestamp",
      images: "++id, canister_id, timestamp",
      pools: "id, address_0, address_1, timestamp",
      user_pools: "id, address_0, address_1, timestamp",
      pool_totals: "++id, tvl, rolling_24h_volume, fees_24h, timestamp",
      transactions: "id",
      favorite_tokens: "++id, wallet_id, canister_id, timestamp, [wallet_id+canister_id]",
      settings: "principal_id, timestamp",
      allowances: "[address+wallet_address], wallet_address, timestamp",
      previous_version: "version",
    }).upgrade(tx => {
      // Clear tables that need schema upgrades
      return Promise.all([
        tx.table('favorite_tokens').clear(),
        tx.table('tokens').clear()
      ]).then(() => {
        console.log('Cleared tables for schema upgrade');
      });
    });

    this.images = this.table("images");
    this.pools = this.table("pools");
    this.user_pools = this.table("user_pools");
    this.pool_totals = this.table("pool_totals");
    this.favorite_tokens = this.table("favorite_tokens");
    this.settings = this.table("settings");
    this.transactions = this.table("transactions");
    this.allowances = this.table("allowances");
    this.previous_version = this.table("previous_version");
    // Set up periodic cache cleanup
    this.setupCacheCleanup();
  }

  private async setupCacheCleanup() {
    // Clean up old cached data every hour
  }
}

// Initialize the database instance
export const kongDB = new KongDB();

// Add hooks for data consistency
kongDB.tokens.hook.creating.subscribe(function (
  primKey: string,
  obj: FE.Token,
  transaction: Transaction,
) {
  obj.timestamp = Date.now();
});

kongDB.tokens.hook.updating.subscribe(function (
  modifications: { [key: string]: any },
  primKey: string,
  obj: FE.Token,
  transaction: Transaction,
) {
  modifications.timestamp = Date.now();
});

kongDB.pools.hook.creating.subscribe(function (
  primKey: string,
  obj: BE.Pool,
  transaction: Transaction,
) {
  obj.timestamp = Date.now();
});

kongDB.pools.hook.updating.subscribe(function (
  modifications: { [key: string]: any },
  primKey: string,
  obj: BE.Pool,
  transaction: Transaction,
) {
  modifications.timestamp = Date.now();
  return modifications;
});

kongDB.tokens.hook.deleting.subscribe(function (
  primKey: string,
  obj: FE.Token,
  transaction: Transaction,
) {
  return kongDB.images.where("canister_id").equals(obj.canister_id).delete();
});
