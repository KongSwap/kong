// src/lib/services/tokens/DexieDB.ts
import Dexie, {
  type Table,
  type Transaction,
} from "dexie";
import type { KongImage, FavoriteToken, TokenBalance } from "$lib/services/tokens/types";
import type { Settings } from "$lib/services/settings/types";

const CURRENT_VERSION = 10;

// Extend Dexie to include the database schema
export class KongDB extends Dexie {
  tokens!: Table<FE.Token>;
  images!: Table<KongImage, number>;
  favorite_tokens!: Table<FavoriteToken & { id?: number }>;
  settings!: Table<Settings, string>;
  pools!: Table<BE.Pool, string>;
  user_pools!: Table<UserPoolBalance, string>;
  pool_totals!: Table<FE.PoolTotal, string>;
  allowances!: Table<FE.AllowanceData, string>;
  previous_version!: Table<number, string>;
  token_balances!: Table<TokenBalance, string>;

  constructor() {
    super("kong_db");

    // First version deletes all tables
    this.version(CURRENT_VERSION - 1).stores({
      tokens: null,
      images: null,
      pools: null,
      user_pools: null,
      pool_totals: null,
      favorite_tokens: null,
      settings: null,
      allowances: null,
      previous_version: null,
      token_balances: null,
    });

    // Next version recreates the schema
    this.version(CURRENT_VERSION).stores({
      tokens: "canister_id, timestamp, metrics.volume_24h",
      images: "++id, canister_id, timestamp",
      pools: "id, address_0, address_1, timestamp",
      user_pools: "++id, [symbol_0+symbol_1], address_0, address_1",
      pool_totals: "id",
      favorite_tokens: "++id, wallet_id, canister_id, timestamp, [wallet_id+canister_id]",
      settings: "principal_id, timestamp",
      allowances: "[address+wallet_address], wallet_address, timestamp",
      previous_version: "version",
      token_balances: "[wallet_id+canister_id], wallet_id, canister_id, timestamp",
    });

    // Initialize all tables
    this.tokens = this.table("tokens");
    this.images = this.table("images");
    this.pools = this.table("pools");
    this.user_pools = this.table("user_pools");
    this.pool_totals = this.table("pool_totals");
    this.favorite_tokens = this.table("favorite_tokens");
    this.settings = this.table("settings");
    this.allowances = this.table("allowances");
    this.previous_version = this.table("previous_version");
    this.token_balances = this.table("token_balances");
  }
}

// Initialize the database instance
export const kongDB = new KongDB();

// Add hooks for data consistency
kongDB.tokens.hook.creating.subscribe((
  primKey: string,
  obj: FE.Token,
  transaction: Transaction,
) => {
  obj.timestamp = Date.now();
});

kongDB.tokens.hook.updating.subscribe((
  modifications: { [key: string]: any },
  primKey: string,
  obj: FE.Token,
  transaction: Transaction,
) => {
  modifications.timestamp = Date.now();
});

kongDB.pools.hook.creating.subscribe((
  primKey: string,
  obj: BE.Pool,
  transaction: Transaction,
) => {
  obj.timestamp = Date.now();
});

kongDB.pools.hook.updating.subscribe((
  modifications: { [key: string]: any },
  primKey: string,
  obj: BE.Pool,
  transaction: Transaction,
) => {
  modifications.timestamp = Date.now();
  return modifications;
});

kongDB.user_pools.hook.creating.subscribe((
  primKey: string,
  obj: UserPoolBalance,
  transaction: Transaction,
) => {
  obj.timestamp = Date.now();
});

kongDB.user_pools.hook.updating.subscribe((
  modifications: { [key: string]: any },
  primKey: string,
  obj: UserPoolBalance,
  transaction: Transaction,
) => {
  modifications.timestamp = Date.now();
  return modifications;
});

kongDB.token_balances.hook.creating.subscribe((
  primKey: string,
  obj: TokenBalance,
  transaction: Transaction,
) => {
  obj.timestamp = Date.now();
});

kongDB.token_balances.hook.updating.subscribe((
  modifications: { [key: string]: any },
  primKey: string,
  obj: TokenBalance,
  transaction: Transaction,
) => {
  modifications.timestamp = Date.now();
  return modifications;
});
