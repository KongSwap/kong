import chalk from 'chalk';
import { Command } from 'commander';
import { deployTestLedgers } from '../utils/ledger.js';
import { deployBackendCanisters, deployInternetIdentity, deployFrontend, deployFaucet } from '../utils/canister.js';
import { execAsync, delay } from '../utils/cli.js';
import { execSync } from 'child_process';
// Check if dfx is installed and running
const checkRequirements = async () => {
    try {
        await execAsync('which dfx', { stdio: 'ignore' });
    }
    catch {
        console.error(chalk.red('dfx is not installed. Please install it first.'));
        process.exit(1);
    }
};
// Setup local network if needed
const setupLocalNetwork = async (network, clean) => {
    if (network === 'local') {
        console.log(chalk.blue('Setting up local network...'));
        if (clean) {
            console.log(chalk.blue('Cleaning local network...'));
            try {
                await execAsync('dfx ping', { stdio: 'ignore' });
                await execAsync('dfx stop', { stdio: 'inherit' });
                await execAsync('dfx killall', { stdio: 'inherit' });
                await execAsync('rm -rf .dfx', { stdio: 'inherit' });
                // Clean up any stale lock files
                await execAsync('rm -f .dfx/network/local/state/replicated_state/node-*/ic_consensus_pool/consensus/LOCK', { stdio: 'inherit' });
                console.log(chalk.green('Cleaned existing network.'));
            }
            catch (error) {
                console.log(chalk.yellow('No existing network found.'));
            }
            console.log(chalk.blue('Starting clean local network...'));
            execSync('dfx start --clean --background', { stdio: 'inherit' });
            await delay(8);
        }
        else {
            console.log(chalk.blue('Starting local network...'));
            try {
                await execAsync('dfx ping', { stdio: 'ignore' });
                console.log(chalk.green('Local network already running.'));
            }
            catch {
                execSync('dfx start --background', { stdio: 'inherit' });
                await delay(8);
            }
        }
        // Wait for network to be ready
        let retries = 30;
        while (retries > 0) {
            try {
                await execAsync('dfx ping', { stdio: 'ignore' });
                console.log(chalk.green('Local network is ready'));
                return;
            }
            catch (error) {
                retries--;
                if (retries === 0) {
                    throw new Error('Failed to start local network after 30 seconds');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
};
// Deploy test environment (ledgers and Internet Identity)
const deployTestEnvironment = async (network) => {
    console.log(chalk.blue('Deploying test environment...'));
    deployTestLedgers(network);
    deployInternetIdentity(network);
    await deployFaucet(network);
};
// Main deploy function
const deploy = async ({ network, clean }) => {
    try {
        await checkRequirements();
        await setupLocalNetwork(network, clean);
        await deployTestEnvironment(network);
        deployBackendCanisters(network);
        deployFrontend(network);
        console.log(chalk.green('Deployment completed successfully!'));
    }
    catch (error) {
        console.error(chalk.red('Deployment failed:'), error.message);
        process.exit(1);
    }
};
// Create and export the deploy command
export const deployCommand = new Command('deploy')
    .description('Deploy Kong infrastructure')
    .option('-n, --network <network>', 'Network to deploy to (local, staging, ic)', 'local')
    .option('-c, --clean', 'Clean deployment (removes existing state)', false)
    .action(async (options) => {
    await deploy({
        network: options.network,
        clean: options.clean
    });
});
