#!/bin/bash

# Test script for Solana settings in Kong backend
# Usage: ./solana_settings.sh <command> [args]
# Commands:
#   get - Get current Solana settings
#   enable - Enable Solana integration
#   disable - Disable Solana integration
#   update - Update all Solana settings
#   is_enabled - Check if Solana is enabled

set -e

COMMAND=$1

# Function to get Solana settings
get_settings() {
  dfx canister call kong_backend get_solana_settings
}

# Function to check if Solana is enabled
is_enabled() {
  dfx canister call kong_backend is_solana_enabled
}

# Function to enable Solana integration
enable_solana() {
  # Create payload with enabled=true
  echo "Enabling Solana integration..."
  dfx canister call kong_backend update_solana_settings '(
    record {
      enabled = true;
      backend_address = opt "Enter your Solana wallet address here";
      rpc_endpoint = opt "https://api.mainnet-beta.solana.com";
      network = opt "mainnet-beta";
      wsol_address = opt "So11111111111111111111111111111111111111112";
      token_program_id = opt "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      system_program_id = opt "11111111111111111111111111111111";
      transaction_timeout_secs = opt 120;
    }
  )'
}

# Function to disable Solana integration
disable_solana() {
  echo "Disabling Solana integration..."
  dfx canister call kong_backend update_solana_settings '(
    record {
      enabled = false;
      backend_address = null;
      rpc_endpoint = null;
      network = null;
      wsol_address = null;
      token_program_id = null;
      system_program_id = null;
      transaction_timeout_secs = null;
    }
  )'
}

# Function to update Solana settings with custom values
update_settings() {
  # Get parameters or use defaults
  BACKEND_ADDRESS=${2:-"Enter your Solana wallet address here"}
  RPC_ENDPOINT=${3:-"https://api.mainnet-beta.solana.com"}
  NETWORK=${4:-"mainnet-beta"}
  
  echo "Updating Solana settings..."
  dfx canister call kong_backend update_solana_settings '(
    record {
      enabled = true;
      backend_address = opt "'$BACKEND_ADDRESS'";
      rpc_endpoint = opt "'$RPC_ENDPOINT'";
      network = opt "'$NETWORK'";
      wsol_address = opt "So11111111111111111111111111111111111111112";
      token_program_id = opt "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
      system_program_id = opt "11111111111111111111111111111111";
      transaction_timeout_secs = opt 120;
    }
  )'
}

# Main command processing
case $COMMAND in
  "get")
    get_settings
    ;;
  "is_enabled")
    is_enabled
    ;;
  "enable")
    enable_solana
    ;;
  "disable")
    disable_solana
    ;;
  "update")
    update_settings "$@"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Usage: ./solana_settings.sh <command> [args]"
    echo "Commands:"
    echo "  get - Get current Solana settings"
    echo "  enable - Enable Solana integration"
    echo "  disable - Disable Solana integration"
    echo "  update - Update all Solana settings"
    echo "  is_enabled - Check if Solana is enabled"
    exit 1
    ;;
esac