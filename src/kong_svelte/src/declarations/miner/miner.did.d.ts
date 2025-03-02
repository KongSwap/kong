export type MinerType = { 'Lite': null } | { 'Normal': null } | { 'Premium': null };

export interface MinerInitArgs {
  owner: Principal | null;
}

export interface Miner {
  minerType: MinerType;
  owner: Principal;
  createdAt: bigint;
  // Add other miner properties as needed
}

export interface MinerStats {
  totalHashRate: bigint;
  totalBlocks: bigint;
  totalRewards: bigint;
  // Add other stats as needed
}

export interface _SERVICE {
  // Miner management
  getOwner: () => Promise<Principal>;
  getMinerType: () => Promise<MinerType>;
  getMinerStats: () => Promise<MinerStats>;
  
  // Add other methods as needed
} 
