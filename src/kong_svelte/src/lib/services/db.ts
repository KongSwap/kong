// src/lib/services/tokens/DexieDB.ts
import Dexie, {
  type Table,
  type Transaction,
} from "dexie";
import type { KongImage, FavoriteToken, TokenBalance } from "$lib/services/tokens/types";
import type { Settings } from "$lib/services/settings/types";

const CURRENT_VERSION = 20;
const DB_OPERATION_TIMEOUT = 10000; // 5 seconds timeout

interface VersionInfo {
  version: number;
  timestamp: number;
}

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
  previous_version!: Table<VersionInfo>;
  token_balances!: Table<TokenBalance, string>;
  private initPromise: Promise<void> | null = null;
  private isUpgrading = false;

  constructor() {
    super("kong_db");

    // Define the schema for each version
    const schema = {
      tokens: "canister_id, timestamp, metrics.volume_24h, metrics.price, metrics.tvl, metrics.market_cap, metrics.price_change_24h",
      images: "++id, canister_id, timestamp",
      pools: "id, address_0, address_1, timestamp",
      user_pools: "++id, [symbol_0+symbol_1], address_0, address_1",
      pool_totals: "id",
      favorite_tokens: "++id, wallet_id, canister_id, timestamp, [wallet_id+canister_id]",
      settings: "principal_id, timestamp",
      allowances: "[address+wallet_address], wallet_address, timestamp",
      previous_version: "version",
      token_balances: "[wallet_id+canister_id], wallet_id, canister_id, timestamp",
    };

    // First, delete all tables in previous version
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
      token_balances: null
    });

    // Then create new schema in current version
    this.version(CURRENT_VERSION).stores(schema).upgrade(async () => {
      console.log(`[DB] Upgrading to version ${CURRENT_VERSION}`);
      this.isUpgrading = true;
      
      try {
        // Delete the entire database outside of the transaction
        await Dexie.delete("kong_db");
        console.log('[DB] Old database deleted');
        
        // Reopen with new schema
        await this.open();
        console.log('[DB] Database reopened with new schema');
        
        // Store the current version
        await this.previous_version.put({
          version: CURRENT_VERSION,
          timestamp: Date.now()
        }, CURRENT_VERSION.toString());
        console.log('[DB] Database upgrade complete');
      } catch (error) {
        console.error('[DB] Error during upgrade:', error);
        throw error;
      } finally {
        this.isUpgrading = false;
      }
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

  async initialize() {
    if (this.isUpgrading) {
      console.log('[DB] Waiting for upgrade to complete before initializing...');
      return new Promise((resolve) => {
        const checkUpgrade = () => {
          if (!this.isUpgrading) {
            resolve(this.doInitialize());
          } else {
            setTimeout(checkUpgrade, 100);
          }
        };
        checkUpgrade();
      });
    }
    return this.doInitialize();
  }

  private async doInitialize() {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          console.log('[DB] Starting database initialization...');
          await this.open();
          const version = await this.previous_version.get('version');
          console.log(`[DB] Database initialized with version ${version || CURRENT_VERSION}`);
        } catch (error) {
          console.error('[DB] Failed to initialize database:', error);
          this.initPromise = null;
          throw error;
        }
      })();
    }
    return this.initPromise;
  }

  // Method to completely reset the database
  async resetDatabase() {
    if (this.isUpgrading) {
      console.log('[DB] Waiting for upgrade to complete before reset...');
      return new Promise((resolve) => {
        const checkUpgrade = () => {
          if (!this.isUpgrading) {
            resolve(this.doReset());
          } else {
            setTimeout(checkUpgrade, 100);
          }
        };
        checkUpgrade();
      });
    }
    return this.doReset();
  }

  private async doReset() {
    try {
      console.log('[DB] Starting database reset...');
      
      // Force close any pending transactions
      await Promise.race([
        this.transaction('rw', this.tables, async () => {
          // Abort all transactions
          Dexie.currentTransaction?.abort();
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction abort timeout')), 1000)
        )
      ]).catch(err => console.warn('[DB] Transaction abort:', err));

      // Close the database with timeout
      await Promise.race([
        this.close(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database close timeout')), DB_OPERATION_TIMEOUT)
        )
      ]);

      // Delete the database with timeout
      await Promise.race([
        Dexie.delete("kong_db"),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database deletion timeout')), DB_OPERATION_TIMEOUT)
        )
      ]);

      console.log('[DB] Database deleted successfully');
      
      // Clear any cached data
      this.initPromise = null;
      
      // Reinitialize the database
      await Promise.race([
        this.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database initialization timeout')), DB_OPERATION_TIMEOUT)
        )
      ]);

      console.log('[DB] Database successfully reset and reinitialized');
      return true;
    } catch (error) {
      console.error("[DB] Error during database reset:", error);
      // Force reload the page as a last resort
      window.location.reload();
      throw error;
    }
  }

  // Helper method to check if database is ready
  async waitForReady() {
    if (this.isUpgrading) {
      console.log('[DB] Waiting for upgrade to complete...');
      return new Promise((resolve) => {
        const checkUpgrade = () => {
          if (!this.isUpgrading) {
            resolve(this.initialize());
          } else {
            setTimeout(checkUpgrade, 100);
          }
        };
        checkUpgrade();
      });
    }
    return this.initialize();
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

// Apply the same pattern to other hooks
kongDB.pools.hook.creating.subscribe((primKey, obj, transaction) => {
  obj.timestamp = Date.now();
});

kongDB.pools.hook.updating.subscribe((modifications, primKey, obj, transaction) => {
  modifications.timestamp = Date.now();
  return modifications;
});

kongDB.user_pools.hook.creating.subscribe((primKey, obj, transaction) => {
  obj.timestamp = Date.now();
});

kongDB.user_pools.hook.updating.subscribe((modifications, primKey, obj, transaction) => {
  modifications.timestamp = Date.now();
  return modifications;
});

kongDB.token_balances.hook.creating.subscribe((primKey, obj, transaction) => {
  obj.timestamp = Date.now();
});

kongDB.token_balances.hook.updating.subscribe((modifications, primKey, obj, transaction) => {
  modifications.timestamp = Date.now();
  return modifications;
});
