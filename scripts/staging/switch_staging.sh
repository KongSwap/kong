#!/usr/bin/env bash

# Copy staging environment-specific canister and dfx configuration
cp ../../canister_ids_staging.json ../../canister_ids.json
cp ../../dfx_staging.json ../../dfx.json
cp ../../.env_staging ../../.env

# Copy staging-specific asset and domain files
cp ../../src/kong_frontend/public/.ic-assets_stage.json5 ../../src/kong_frontend/public/.ic-assets.json5
cp ../../src/kong_frontend/public/.well-known/ic-domains_stage ../../src/kong_frontend/public/.well-known/ic-domains
cp ../../src/kong_frontend/public/.well-known/ii-alternative-origins_stage ../../src/kong_frontend/public/.well-known/ii-alternative-origins

echo "Staging environment files have been copied."