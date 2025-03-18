#!/bin/bash

# usage: create_canister_id.sh (local|staging|ic)

original_dir=$(pwd)
# Use the current directory, not the parent directory
root_dir="${original_dir}"

input=$(cat "${root_dir}"/canister_ids.all.json)

# Use jq to transform the JSON, using the first command line argument
#output=$(echo "$input" | jq -c --arg key "$1" 'to_entries | map({(.key): {($key): .value[$key]}}) | add')
output=$(echo "$input" | jq -c --arg key "$1" 'to_entries | map(select(.value[$key] != "")) | map({(.key): {($key): .value[$key]}}) | add')

# Print the output
echo "$output" | jq > "${root_dir}"/canister_ids.json
