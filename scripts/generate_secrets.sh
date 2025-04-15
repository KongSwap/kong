#!/bin/bash

# Get the project root directory (1 level up from scripts folder)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

# Source the .env file from project root
echo "generate_secrets.sh: PROJECT_ROOT is ${PROJECT_ROOT}" # Added for debugging
echo "generate_secrets.sh: Sourcing .env from ${PROJECT_ROOT}/.env"
source "${PROJECT_ROOT}/.env"

# Pull secrets from Doppler and save to .secrets in the project root.
# Vite will automatically merge the secrets with the root .env file at build time.

if [ "$DFX_NETWORK" != "local" ] && command -v doppler &> /dev/null; then
  # Write to project root
  doppler secrets download --config ${DFX_NETWORK} --no-file --format env > "${PROJECT_ROOT}/.secrets"
else
  echo "Warning: doppler is not installed. Skipping secrets generation."
  # Create an empty .secrets file in the project root to allow the build to continue
  touch "${PROJECT_ROOT}/.secrets"
fi