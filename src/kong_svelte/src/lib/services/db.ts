// src/lib/services/tokens/DexieDB.ts
import Dexie, {
  type Table,
  type Transaction,
} from "dexie";
import type { KongImage, FavoriteToken } from "$lib/services/tokens/types";
import type { Settings } from "$lib/services/settings/types";
import { browser } from "$app/environment";

const CURRENT_VERSION = 7;

// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token>;
  images!: Table<KongImage, number>; // Table<KongImage, primary key type>
  favorite_tokens!: Table<FavoriteToken & { id?: number }>;
  settings!: Table<Settings, string>; // Add settings table
  pools!: Table<BE.Pool, string>;
  user_pools!: Table<UserPoolBalance, string>;
  pool_totals!: Table<FE.PoolTotal, string>;
  transactions!: Table<FE.Transaction, number>;
  allowances!: Table<FE.AllowanceData, string>;
  previous_version!: Table<number, string>

  constructor() {
    super("kong_db"); // Database name

    // Version 7 schema (current version)
    this.version(CURRENT_VERSION).stores({
      tokens: "canister_id, timestamp, metrics.volume_24h",
      images: "++id, canister_id, timestamp",
      pools: "id, address_0, address_1, timestamp",
      user_pools: "++id, [symbol_0+symbol_1], address_0, address_1",
      pool_totals: "id",
      transactions: "id",
      favorite_tokens: "++id, wallet_id, canister_id, timestamp, [wallet_id+canister_id]",
      settings: "principal_id, timestamp",
      allowances: "[address+wallet_address], wallet_address, timestamp",
      previous_version: "version",
    }).upgrade(async tx => {
        tx.db.delete()
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
    if (browser) {
      setInterval(async () => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        await Promise.all([
          this.images.where('timestamp').below(oneHourAgo).delete(),
          this.pools.where('timestamp').below(oneHourAgo).delete(),
          this.user_pools.where('timestamp').below(oneHourAgo).delete(),
        ]);
      }, 60 * 60 * 1000); // Run every hour
    }
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

// Add hooks for user_pools table
kongDB.user_pools.hook.creating.subscribe(function (
  primKey: string,
  obj: UserPoolBalance,
  transaction: Transaction,
) {
  obj.timestamp = Date.now();
});

kongDB.user_pools.hook.updating.subscribe(function (
  modifications: { [key: string]: any },
  primKey: string,
  obj: UserPoolBalance,
  transaction: Transaction,
) {
  modifications.timestamp = Date.now();
  return modifications;
});
