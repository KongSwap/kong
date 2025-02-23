#!/usr/bin/env bash
# ------------------------------------------------------------------
# This script performs an ICRC‑1 token transfer from your ICP ledger
# to the Cycle Minting Canister (CMC), including a memo that signals
# a “create canister” operation.
#
# It uses a temporary file to pass the Candid argument (to avoid
# shell quoting and escape issues) and uses octal escapes for the memo.
# ------------------------------------------------------------------

# Set ledger and CMC principals
ICP_LEDGER_ID="ryjl3-tyaaa-aaaaa-aaaba-cai"
CMC_PRINCIPAL="rkp4c-7iaaa-aaaaa-aaaca-cai"

# 0.5 ICP expressed in e8s (0.5 ICP = 50,000,000 e8s)
ICP_AMOUNT_E8S=1800000

# Ensure dfx is available
if ! command -v dfx >/dev/null 2>&1; then
  echo "Error: dfx command not found. Please install DFX and ensure it's in your PATH." >&2
  exit 1
fi

# Check authentication
IDENTITY=$(dfx identity whoami 2>/dev/null)
if [[ -z "$IDENTITY" ]]; then
  echo "Error: Not authenticated. Run 'dfx identity use <identity-name>' first." >&2
  exit 1
fi

# Get your principal
PRINCIPAL=$(dfx identity get-principal 2>/dev/null)
if [[ -z "$PRINCIPAL" ]]; then
  echo "Error: Could not get principal ID. Check your dfx identity." >&2
  exit 1
fi

# Check ICP ledger balance on network ic
RAW_BALANCE=$(dfx ledger --network ic balance --ledger-canister-id "$ICP_LEDGER_ID" 2>/dev/null)
if [[ -z "$RAW_BALANCE" ]]; then
  echo "Error: Could not check balance." >&2
  exit 1
fi

# Extract numeric balance and convert to e8s
BALANCE_NUM=$(echo "$RAW_BALANCE" | awk '{print $1}')
BALANCE_E8S=$(echo "$BALANCE_NUM * 100000000 / 1" | bc)
if [ "$BALANCE_E8S" -lt "$ICP_AMOUNT_E8S" ]; then
  echo "Error: Insufficient balance." >&2
  exit 1
fi

echo "Sending .50000000 ICP with canister creation memo..."

# Calculate your subaccount (as a hex string) from your principal.
# This Python snippet decodes the principal, skips the first 4 bytes,
# and then pads/truncates to form the required 32-byte subaccount.
SUBACCOUNT_HEX=$(python3 -c "import base64,sys
p=sys.argv[1].replace('-','').upper()
for pad in (0,1,3,4,6):
    try:
        raw=base64.b32decode(p + '='*pad)
        break
    except Exception:
        continue
principal_bytes = raw[4:]
sub = bytes([len(principal_bytes)]) + principal_bytes + bytes(32 - len(principal_bytes) - 1)
print(sub.hex())" "$PRINCIPAL")

# Build a Candid vector expression from the hex string (e.g. 0xAB; 0xCD; …)
SUBACCOUNT_CANDID=$(echo "$SUBACCOUNT_HEX" | sed 's/\([0-9a-f][0-9a-f]\)/0x\1; /g' | sed 's/; $//')

# Write the Candid argument to a temporary file.
# Notice that for the memo we use octal escapes:
#   \101  = 0x41, \105 = 0x45, \122 = 0x52, \103 = 0x43
# This produces a blob with the exact 4-byte value required.
TMP_ARG=$(mktemp /tmp/icrc1_arg.XXXXXX.did)
cat > "$TMP_ARG" <<EOF
(record {
  to = record {
    owner = principal "$CMC_PRINCIPAL";
    subaccount = opt vec { $SUBACCOUNT_CANDID }
  };
  amount = $ICP_AMOUNT_E8S;
  fee = null;
  memo = opt blob "\103\122\105\101";
  from_subaccount = null;
  created_at_time = null
})
EOF

# Execute the transfer using the temporary argument file.
TRANSFER_OUTPUT=$(dfx canister --network ic call "$ICP_LEDGER_ID" icrc1_transfer --argument-file "$TMP_ARG" 2>&1)
STATUS=$?
rm "$TMP_ARG"  # Clean up the temporary file

if [ $STATUS -ne 0 ]; then
  echo "Error: ICP transfer failed. Details:" >&2
  echo "$TRANSFER_OUTPUT" >&2
  exit 1
fi

echo "Transfer output: $TRANSFER_OUTPUT"

# If the output indicates an error, exit.
if echo "$TRANSFER_OUTPUT" | grep -qi "err"; then
  echo "Error: Transfer returned an error:" >&2
  echo "$TRANSFER_OUTPUT" >&2
  exit 1
fi

# Extract the block height (remove underscores if any)
BLOCK_HEIGHT=$(echo "$TRANSFER_OUTPUT" | grep -o '[0-9_]*' | head -n1 | tr -d '_')
if [[ -z "$BLOCK_HEIGHT" ]]; then
  echo "Error: Could not parse block height from transfer output." >&2
  exit 1
fi

echo "Transfer successful! Your canister will be created shortly."
echo "Block height: $BLOCK_HEIGHT"
