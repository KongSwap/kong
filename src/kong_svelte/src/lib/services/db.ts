// src/lib/services/tokens/DexieDB.ts
import Dexie, {
  type Table,
  type Transaction,
  type DBCoreTransaction,
} from "dexie";
import type { KongImage, FavoriteToken } from "$lib/services/tokens/types";
import type { Settings } from "$lib/services/settings/types";

// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token, string>; // Table<KongImage, primary key type>
  images!: Table<KongImage, number>; // Table<KongImage, primary key type>
  favorite_tokens!: Table<FavoriteToken, string>; // Table<FavoriteToken, primary key type>
  settings!: Table<Settings, string>; // Add settings table
  pools!: Table<BE.Pool, string>;
  transactions: Table<FE.Transaction, number>;
  allowances: Table<FE.AllowanceData, string>;

  constructor() {
    super("kong_db"); // Database name

    // Increase version number for new schema
    this.version(2).stores({
      tokens: "canister_id, timestamp, *metrics.price",
      images: "++id, canister_id, timestamp",
      pools: "id, address_0, address_1, timestamp",
      transactions: "id",
      favorite_tokens: "[canister_id+wallet_id], wallet_id, timestamp",
      settings: "principal_id, timestamp",
      allowances: "[address+wallet_address], wallet_address, timestamp",
    });

    // Add upgrade logic
    this.version(2).upgrade((tx) => {
      return tx
        .table("tokens")
        .toCollection()
        .modify((token) => {
          if (!token.timestamp) token.timestamp = Date.now();
        });
    });

    this.tokens = this.table("tokens");
    this.images = this.table("images");
    this.pools = this.table("pools");
    this.favorite_tokens = this.table("favorite_tokens");
    this.settings = this.table("settings");
    this.transactions = this.table("transactions");
    this.allowances = this.table("allowances");
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
