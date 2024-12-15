#!/usr/bin/env bash

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [ "$KONG_BUILDENV" = "ic" ]; then
    [ -f "${SCRIPT_DIR}/../.dfx/ic/canisters/kong_backend/kong_backend.wasm" ] && {
        ic-wasm "${SCRIPT_DIR}/../.dfx/ic/canisters/kong_backend/kong_backend.wasm" -o "${SCRIPT_DIR}/../.dfx/ic/canisters/kong_backend/kong_backend_opt.wasm" optimize O3
        gzip -c "${SCRIPT_DIR}/../.dfx/ic/canisters/kong_backend/kong_backend_opt.wasm" > "${SCRIPT_DIR}/../.dfx/ic/canisters/kong_backend/kong_backend.wasm.gz"
        rm "${SCRIPT_DIR}/../.dfx/ic/canisters/kong_backend/kong_backend_opt.wasm"
    }
fi
