import { execSync } from 'child_process';
import chalk from 'chalk';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import canisterIds from '../../canister_ids.all.json' with { type: 'json' };

type CanisterNetwork = 'local' | 'staging' | 'staging_fe' | 'ic';

// Helper to get canister ID with type safety
const getCanisterId = (name: string, network: CanisterNetwork): string | undefined => {
  return (canisterIds as any)[name]?.[network];
};

// Get current module path and workspace root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '../../../../');
const scriptsPath = resolve(workspaceRoot, 'scripts');

export const deployLedger = (ledger: string, network: string) => {
  const ledgerName = `${ledger}_ledger`;
  const canisterId = getCanisterId(ledgerName, network as CanisterNetwork);
  
  console.log(chalk.blue(`Deploying ${ledger} ledger...`));
  if (canisterId) {
    console.log(chalk.blue(`Using existing canister ID ${canisterId}`));
  }
  
  // Use absolute path to script
  execSync(`bash ${scriptsPath}/deploy_${ledger}_ledger.sh ${network}`, { 
    stdio: 'inherit',
    cwd: workspaceRoot,
    env: { 
      ...process.env, 
      CANISTER_IDS_ROOT: workspaceRoot,
      SPECIFIED_ID: canisterId || ''
    }
  });
};

// List of all test ledgers
export const TEST_LEDGERS = ['ksusdt', 'ksicp', 'ksbtc', 'kseth', 'kskong'] as const;
export type TestLedger = typeof TEST_LEDGERS[number];

// Deploy all test ledgers for a given network
export const deployTestLedgers = (network: string) => {
  console.log(chalk.blue('Deploying test ledgers...'));
  TEST_LEDGERS.forEach(ledger => deployLedger(ledger, network));
};
