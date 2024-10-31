#!/bin/bash

# Define the token information as an array of strings
# Format: "token_name canister_id"
tokens=("GLDT 6c7su-kiaaa-aaaar-qaira-cai"
        "GHOST 4c4fd-caaaa-aaaaq-aaa3a-cai"
        "CTZ uf2wh-taaaa-aaaaq-aabna-cai"
        "ELNA gemj7-oyaaa-aaaaq-aacnq-cai"
        "DOGMI np5km-uyaaa-aaaaq-aadrq-cai"
        "EST bliq2-niaaa-aaaaq-aac4q-cai"
        "PANDA druyg-tyaaa-aaaaq-aactq-cai"
        "KINIC 73mez-iiaaa-aaaaq-aaasq-cai"
        "DOLR 6rdgd-kyaaa-aaaaq-aaavq-cai"
        "TRAX emww2-4yaaa-aaaaq-aacbq-cai"
        "MOTOKO k45jy-aiaaa-aaaaq-aadcq-cai"
        "ckPEPE etik7-oiaaa-aaaar-qagia-cai"
        "ckSHIB fxffn-xiaaa-aaaar-qagoa-cai"
        "DOD cp4zx-yiaaa-aaaah-aqzea-cai")

# Define paths to templates and destination
BOB_LEDGER_DIR="./bob_ledger"
DIDC_PATH="/Users/sergiunistorcosmin/didc/didc-linux64"  # Replace with the absolute path to `didc`

# Function to check if a file is empty or not
check_file_not_empty() {
    if [ ! -s "$1" ]; then
        echo "Error: File $1 is empty or does not exist. Skipping generation of .ts and .js bindings."
        return 1
    fi
    return 0
}

# Iterate over each token and create the respective directory and files
for token in "${tokens[@]}"; do
  # Split the token name and canister id
  IFS=' ' read -r token_name canister_id <<< "$token"

  # Convert the token name to lowercase for the directory name
  lowercase_token_name=$(echo "$token_name" | tr '[:upper:]' '[:lower:]')
  folder_name="${lowercase_token_name}_ledger"
  
  # Create the new directory if it doesn't exist
  mkdir -p "$folder_name"

  # Copy index.d.ts and index.js from bob_ledger to the new directory
  cp "$BOB_LEDGER_DIR/index.d.ts" "$folder_name/index.d.ts"
  cp "$BOB_LEDGER_DIR/index.js" "$folder_name/index.js"

  # Execute the commands to generate the .did, .ts, and .js files
  echo "Generating files for $token_name in $folder_name..."
  dfx canister --ic metadata "$canister_id" candid:service > "$folder_name/${lowercase_token_name}ckusdt.did"
  $DIDC_PATH bind "$folder_name/${lowercase_token_name}ckusdt.did" -t ts > "$folder_name/${lowercase_token_name}ckusdt.did.ts"
  $DIDC_PATH bind "$folder_name/${lowercase_token_name}ckusdt.did" -t js > "$folder_name/${lowercase_token_name}ckusdt.did.js"

  echo "Files for $token_name generated successfully!"
done

echo "All bindings have been created successfully!"