import chalk from "chalk";
import { Command } from "commander";
import { execAsync } from "../utils/cli.js";

// Setup local network if needed
export const cleanDfx = async (restart: boolean = false) => {
  console.log(chalk.blue("Cleaning dfx..."));
  try {
    await execAsync("dfx ping", { stdio: "ignore" });
    await execAsync("dfx stop", { stdio: "inherit" });
    await execAsync("dfx killall", { stdio: "inherit" });
    await execAsync("rm -rf .dfx", { stdio: "inherit" });
    // Clean up any stale lock files
    await execAsync(
      "rm -f .dfx/network/local/state/replicated_state/node-*/ic_consensus_pool/consensus/LOCK",
      { stdio: "inherit" }
    );
    console.log(chalk.green("Cleaned existing network."));
  } catch (error) {
    console.log(chalk.yellow("No existing network found."));
  }

  if (restart) {
    console.log(chalk.blue("Restarting dfx..."));
    await execAsync("dfx start --clean --background", { stdio: "inherit" });
    console.log(chalk.green("DFX restarted successfully."));
  }
};

export const cleanCommand = new Command("clean")
  .description("Clean dfx state and optionally restart it")
  .option("-r, --restart", "Restart dfx after cleaning")
  .action(async (options) => {
    await cleanDfx(options.restart);
  });
