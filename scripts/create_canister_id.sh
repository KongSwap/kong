#!/bin/bash

# usage: create_canister_id.sh (local|staging|ic)

original_dir=$(pwd)
root_dir="${original_dir}"/..
cd "${root_dir}"
input=$(cat canister_ids.all.json)

# Use jq to transform the JSON, using the first command line argument
output=$(echo "$input" | jq -c --arg key "$1" 'to_entries | map({(.key): {($key): .value[$key]}}) | add')

# Print the output
echo "$output" | jq > canister_ids.json

cd "$original_dir"