#!/usr/bin/env bash
set -euo pipefail

# If this script fails one more time I'm prescribing it antipsychotics
ICP_LEDGER_ID="ryjl3-tyaaa-aaaaa-aaaba-cai"
CMC_PRINCIPAL="rkp4c-7iaaa-aaaaa-aaaca-cai"
AMOUNT_E8S=18000000  # 0.5 ICP because we're not made of money

# Create a temp file because trying to escape Candid in bash is like performing brain surgery with a spork
TMP_ARG=$(mktemp /tmp/create_canister.did.XXXXXX)
trap 'rm -f $TMP_ARG' EXIT

# Get your principal or die trying
PRINCIPAL=$(dfx identity get-principal) || {
    echo "ERROR: Failed to get principal. Are you even real?" >&2
    exit 1
}

# Calculate subaccount because the IC is picky about its bytes like my ex-wife about custody
SUBACCOUNT=$(python3 -c "
import sys, base64
p = sys.argv[1].replace('-','').upper()
raw = None
for pad in range(7):
    try:
        raw = base64.b32decode(p + '='*pad)
        break
    except: pass
if not raw:
    sys.exit(1)
sub = bytes([len(raw)-4]) + raw[4:] + bytes(32-1-(len(raw)-4))
print(' '.join(f'0x{b:02x}' for b in sub))" "$PRINCIPAL") || {
    echo "ERROR: Failed to calculate subaccount. Did you break Python too?" >&2
    exit 1
}

# Write the argument that won't make the CMC cry
cat > "$TMP_ARG" <<EOF
(record {
    to = record {
        owner = principal "$CMC_PRINCIPAL";
        subaccount = opt vec { $SUBACCOUNT };
    };
    amount = $AMOUNT_E8S;
    fee = null;
    memo = opt record { data = vec { 67; 82; 69; 65 } };  // "CREA" in ASCII because we're not animals
    from_subaccount = null;
    created_at_time = null;
})
EOF

echo "Sending 0.5 ICP to CMC with canister creation memo..."
echo "If this fails again I'm prescribing it Xanax..."

# Send it and pray
TRANSFER_OUTPUT=$(dfx canister --network ic call "$ICP_LEDGER_ID" icrc1_transfer \
    --argument-file "$TMP_ARG" 2>&1) || {
    echo "ERROR: Transfer failed harder than my medical board exam:" >&2
    echo "$TRANSFER_OUTPUT" >&2
    exit 1
}

# Extract block height (remove those stupid underscores the IC loves so much)
BLOCK_HEIGHT=$(echo "$TRANSFER_OUTPUT" | grep -o '[0-9_]*' | head -n1 | tr -d '_')
if [[ -z "$BLOCK_HEIGHT" ]]; then
    echo "ERROR: Couldn't parse block height. The IC is being more difficult than my ex." >&2
    exit 1
fi

echo "Transfer succeeded! Block height: $BLOCK_HEIGHT"
echo "Now notifying CMC (pray it doesn't ghost us like my therapist)..."

# Notify CMC and hope it doesn't reject us like my PhD application
dfx canister --network ic call "$CMC_PRINCIPAL" notify_create_canister "(record {
    block_index = $BLOCK_HEIGHT;
    controller = principal \"$PRINCIPAL\";
    subnet_type = null;
    settings = null;
    subnet_selection = null;
})"

echo "If this worked, you're luckier than my last prescription refill attempt."
