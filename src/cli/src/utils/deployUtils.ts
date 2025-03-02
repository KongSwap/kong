import { execSync } from 'child_process';
import chalk from 'chalk';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import canisterIds from '../../canister_ids.all.json' with { type: 'json' };
import type { CanisterNetwork } from '../types/network.js';
import { execAsync } from './cli.js';

// Get current module path and workspace root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '../../../../');

// Helper to get canister ID with type safety
export const getCanisterId = (name: string, network: CanisterNetwork): string | undefined => {
  return (canisterIds as any)[name]?.[network];
};

// Core backend canisters that need to be deployed
export const BACKEND_CANISTERS = [
  'kong_backend',
  'kong_data',
  'prediction_markets_backend'
] as const;

export type BackendCanister = typeof BACKEND_CANISTERS[number];

// Deploy a single canister with proper error handling
export const deployCanister = (canister: string, network: CanisterNetwork, options: { timeout?: number } = {}) => {
  console.log(chalk.blue(`Deploying ${canister}...`));
  const canisterId = getCanisterId(canister, network);
  
  try {
    if (canisterId) {
      console.log(chalk.blue(`Using existing canister ID ${canisterId}`));
      execSync(`dfx deploy ${canister} --network ${network} --specified-id ${canisterId}`, { 
        stdio: 'inherit',
        timeout: options.timeout
      });
    } else {
      console.log(chalk.yellow(`Warning: No canister ID found for ${canister} on network ${network}`));
      execSync(`dfx deploy ${canister} --network ${network}`, { 
        stdio: 'inherit',
        timeout: options.timeout
      });
    }
  } catch (error: any) {
    console.error(chalk.red(`Error deploying ${canister}:`), error.message);
    throw error;
  }
};

// Deploy all backend canisters
export const deployBackendCanisters = (network: CanisterNetwork) => {
  console.log(chalk.blue('Deploying backend canisters...'));
  BACKEND_CANISTERS.forEach(canister => deployCanister(canister, network));
};

// Deploy Internet Identity (only for local network)
export const deployInternetIdentity = (network: CanisterNetwork) => {
  if (network === 'local') {
    console.log(chalk.blue('Deploying Internet Identity...'));
    execSync(`dfx deploy internet_identity --network ${network}`, { stdio: 'inherit' });
  }
};

// Deploy Kong Svelte frontend
export const deployFrontend = (network: CanisterNetwork) => {
  console.log(chalk.blue('Building and deploying kong_svelte (this may take a while)...'));
  deployCanister('kong_svelte', network, { timeout: 600000 }); // 10 minute timeout
};

// Deploy Kong Faucet and mint tokens
export const deployFaucet = async (network: CanisterNetwork) => {
  if (network !== 'local' && network !== 'staging') return;
  
  console.log(chalk.blue('Deploying kong_faucet...'));
  const canisterId = getCanisterId('kong_faucet', network);
  
  try {
    if (canisterId) {
      console.log(chalk.blue(`Using existing canister ID ${canisterId}`));
      await execAsync(`KONG_BUILDENV=${network} dfx deploy kong_faucet --network ${network} --specified-id ${canisterId}`, { 
        stdio: 'inherit'
      });
    } else {
      await execAsync(`KONG_BUILDENV=${network} dfx deploy kong_faucet --network ${network}`, { 
        stdio: 'inherit'
      });
    }

    // Mint tokens to faucet
    console.log(chalk.blue('Minting tokens to faucet...'));
    const faucetId = await execAsync(`dfx canister --network ${network} id kong_faucet`);
    
    const tokens = [
      { symbol: 'ksusdt', amount: '100_000_000_000_000' },     // 100,000,000 ksUSDT
      { symbol: 'ksicp', amount: '1_000_000_000_000_000' },    // 10,000,000 ksICP
      { symbol: 'ksbtc', amount: '150_000_000_000' },          // 1,500 ksBTC
      { symbol: 'kseth', amount: '30_000_000_000_000_000_000_000' }, // 30,000 ksETH
      { symbol: 'kong', amount: '200_000_000_000_000' }      // 2,000,000 KONG
    ];

    for (const token of tokens) {
      console.log(chalk.blue(`Minting ${token.symbol} to faucet...`));
      await execAsync(`dfx canister --network ${network} --identity kong_token_minter call ${token.symbol}_ledger icrc1_transfer '(record {
        to=record {owner=principal "${faucetId}"; subaccount=null};
        amount=${token.amount};
      })'`, { stdio: 'inherit' });
    }

  } catch (error: any) {
    console.error(chalk.red(`Error deploying kong_faucet:`), error.message);
    throw error;
  }
}; 