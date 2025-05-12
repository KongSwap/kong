#!/bin/bash

# script will resolve the winner of each pair and to the payout to the wallets

# Resolve market - KONG wins
echo "Resolving market - KONG wins (outcome 0)"
dfx identity use default

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market BOB vs MCDOMS - MCDOMS wins"
./resolve_market.sh 0 1

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market CLOUD vs PONZI - PONZI wins"
./resolve_market.sh 1 1

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market ELNA vs PANDA - PANDA wins"
./resolve_market.sh 2 1

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market EXE vs ALICE - EXE wins"
./resolve_market.sh 3 0

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market RAVEN vs DKP - RAVEN wins"
./resolve_market.sh 4 1

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market WTN vs WELL - WTN wins"
./resolve_market.sh 5 0

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market ALEX vs CHAT - ALEX wins"
./resolve_market.sh 6 0

echo "--------------------------------------------------------"
echo "resolve Kongswap Madness market KONG vs AWB - KONG wins"
./resolve_market.sh 7 0 

echo "--------------------------------------------------------"
echo "get balances after resolution"
./get_balance.sh