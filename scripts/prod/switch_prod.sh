#!/usr/bin/env bash

# Copy production environment-specific canister and dfx configuration
cp ../../canister_ids_prod.json ../../canister_ids.json
cp ../../dfx_prod.json ../../dfx.json
cp ../../.env_prod ../../.env

# Copy production-specific asset and domain files
cp ../../src/kong_frontend/public/.ic-assets_prod.json5 ../../src/kong_frontend/public/.ic-assets.json5
cp ../../src/kong_frontend/public/.well-known/ic-domains_prod ../../src/kong_frontend/public/.well-known/ic-domains
cp ../../src/kong_frontend/public/.well-known/ii-alternative-origins_prod ../../src/kong_frontend/public/.well-known/ii-alternative-origins

echo "Production environment files have been copied."