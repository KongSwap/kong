#!/usr/bin/env bash

original_dir=$(pwd)
root_dir="${original_dir}"/..

if [ "$1" == "ic" ]; then
    [ -f "${root_dir}"/.dfx/ic/canisters/kong_data/kong_data.wasm ] && {
        ic-wasm "${root_dir}"/.dfx/ic/canisters/kong_data/kong_data.wasm -o "${root_dir}"/.dfx/ic/canisters/kong_data/kong_data_opt.wasm optimize O3
        gzip -c "${root_dir}"/.dfx/ic/canisters/kong_data/kong_data_opt.wasm > "${root_dir}"/.dfx/ic/canisters/kong_data/kong_data.wasm.gz
        sha256sum "${root_dir}"/.dfx/ic/canisters/kong_backend/kong_backend.wasm.gz
        rm "${root_dir}"/.dfx/ic/canisters/kong_data/kong_data_opt.wasm
    }
fi
