#!/bin/bash

# Get the kong_ledger canister ID
KONG_LEDGER=$(dfx canister id kong_ledger)

# Array of principals to check
principals=(
    "67hvh-lwbpq-7mvab-uvaqz-ilcvt-6fqn5-spiaa-dlq62-eukxk-e44cm-iae"
    "4jxje-hbmra-4otqc-6hor3-cpwlh-sqymk-6h4ef-42sqn-o3ip5-s3mxk-uae"
    "ryc6f-4jn4r-3tzot-zlpqv-nniay-bgccd-idle4-5llbq-ht3ij-hk3r7-2ae"
    "cfkk4-3cb27-jbkl4-oycde-2cy3s-6km4e-o4b5v-qz54y-iifed-xo4mr-eae"
    "bkyz2-fmaaa-aaaaa-qaaaq-cai"
)

# Function to get human-readable name for a principal
get_name_for_principal() {
    case "$1" in
        "67hvh-lwbpq-7mvab-uvaqz-ilcvt-6fqn5-spiaa-dlq62-eukxk-e44cm-iae")
            echo "kong"
            ;;
        "4jxje-hbmra-4otqc-6hor3-cpwlh-sqymk-6h4ef-42sqn-o3ip5-s3mxk-uae")
            echo "default"
            ;;
        "ryc6f-4jn4r-3tzot-zlpqv-nniay-bgccd-idle4-5llbq-ht3ij-hk3r7-2ae")
            echo "kong_user1"
            ;;
        "cfkk4-3cb27-jbkl4-oycde-2cy3s-6km4e-o4b5v-qz54y-iifed-xo4mr-eae")
            echo "kong_user2"
            ;;
        "bw4dl-smaaa-aaaaa-qaacq-cai")
            echo "prediction_markets_backend"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Loop through each principal and get their balance
for principal in "${principals[@]}"; do
    name=$(get_name_for_principal "$principal")
    echo "Getting balance for $name ($principal)"
    dfx canister call $KONG_LEDGER icrc1_balance_of "(record { owner = principal \"$principal\"; subaccount = null })"
    echo "----------------------------------------"
done
