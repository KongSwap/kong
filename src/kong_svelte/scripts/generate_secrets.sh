#!/bin/bash
source ../../.env

# Pull secrets from Doppler and save to .secrets. 
# Vite will automatically merge the secrets with the root .env file at build time.
doppler secrets download --config ${DFX_NETWORK} --no-file --format env > .secrets