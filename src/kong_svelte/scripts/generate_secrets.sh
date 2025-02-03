#!/bin/bash

# Get the project root directory (3 levels up from scripts folder)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../.. && pwd)"

# Source the .env file from project root
source "${PROJECT_ROOT}/.env"

# Pull secrets from Doppler and save to .secrets. 
# Vite will automatically merge the secrets with the root .env file at build time.

if [ "$DFX_NETWORK" != "local" ] && command -v doppler &> /dev/null; then
  doppler secrets download --config ${DFX_NETWORK} --no-file --format env > .secrets
else
  echo "Warning: doppler is not installed. Skipping secrets generation."
  # Create an empty .secrets file to allow the build to continue
  touch .secrets
fi