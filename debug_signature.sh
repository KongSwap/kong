#!/bin/bash

# Debug script to see exactly what the shell script signs
# Based on the user's working shell script

# Test message (using similar values to browser)
TIMESTAMP=$(date +%s)000
PAY_TOKEN="SOL"
PAY_AMOUNT_NAT=10000000
PAY_ADDRESS="CaskZcEG28E9F1qgEsw4bgpWExW7VFWx88Dy1EBF4FK4"
RECEIVE_TOKEN="ICP"
RECEIVE_AMOUNT_NAT=500000
RECEIVE_ADDRESS="42s3u-zifnr-er5mr-5o4di-udavb-jhxk7-g6s3t-le2ft-hqtfc-b6oqe-xqe"
MAX_SLIPPAGE=99.0

echo "=== SHELL SCRIPT SIGNATURE DEBUG ==="

# Create the exact same message as shell script
TX_MESSAGE_JSON=$(cat <<EOF
{
  "pay_token": "${PAY_TOKEN}",
  "pay_amount": ${PAY_AMOUNT_NAT},
  "pay_address": "${PAY_ADDRESS}",
  "receive_token": "${RECEIVE_TOKEN}",
  "receive_amount": ${RECEIVE_AMOUNT_NAT},
  "receive_address": "${RECEIVE_ADDRESS}",
  "max_slippage": ${MAX_SLIPPAGE},
  "timestamp": ${TIMESTAMP},
  "referred_by": null
}
EOF
)

echo "1. Raw JSON:"
echo "$TX_MESSAGE_JSON"

# Compact it like the shell script
TX_MESSAGE_COMPACT=$(echo "$TX_MESSAGE_JSON" | jq -c .)
echo ""
echo "2. Compact JSON (what gets signed):"
echo "$TX_MESSAGE_COMPACT"

# Show message length
echo ""
echo "3. Message length: ${#TX_MESSAGE_COMPACT}"

# Show hex bytes of the message
echo ""
echo "4. Message as hex bytes:"
echo -n "$TX_MESSAGE_COMPACT" | xxd

# Try signing (if solana CLI is available)
if command -v solana &> /dev/null; then
    echo ""
    echo "5. Attempting to sign with Solana CLI..."
    TX_SIGNATURE=$(solana sign-offchain-message "$TX_MESSAGE_COMPACT" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "✅ Signature: $TX_SIGNATURE"
        echo "📏 Signature length: ${#TX_SIGNATURE}"
    else
        echo "❌ Signing failed (wallet not configured or CLI not available)"
    fi
else
    echo ""
    echo "5. Solana CLI not available for signing"
fi

echo ""
echo "=== END DEBUG ===" 