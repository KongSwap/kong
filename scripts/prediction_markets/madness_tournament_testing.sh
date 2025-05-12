#!/bin/bash

# script will create the tournament and place bets on each pair

# Constants for bet amounts (in e8s)
KONG_BET=10000000000
DEFAULT_BET=30000000000
USER1_BET=70000000000
USER2_BET=40000000000

echo "--------------------------------------------------------"
echo "Balances before tournament"
echo "--------------------------------------------------------"
./get_balance.sh

dfx identity use default

./r1_kong_madness.sh

echo "--------------------------------------------------------"
dfx identity use kong

# place a bet on each pair 0 to 8
echo "Placing bets on each pair for Kong"
./place_bet.sh 0 0 $KONG_BET
./place_bet.sh 1 0 $KONG_BET 
./place_bet.sh 2 0 $KONG_BET
./place_bet.sh 3 0 $KONG_BET
./place_bet.sh 4 0 $KONG_BET
./place_bet.sh 5 0 $KONG_BET
./place_bet.sh 6 0 $KONG_BET
./place_bet.sh 7 0 $KONG_BET

echo "--------------------------------------------------------"
dfx identity use default

echo "Placing bets on each pair for Default"
./place_bet.sh 0 1 $DEFAULT_BET
./place_bet.sh 1 1 $DEFAULT_BET 
./place_bet.sh 2 1 $DEFAULT_BET
./place_bet.sh 3 1 $DEFAULT_BET
./place_bet.sh 4 1 $DEFAULT_BET
./place_bet.sh 5 1 $DEFAULT_BET
./place_bet.sh 6 1 $DEFAULT_BET
./place_bet.sh 7 1 $DEFAULT_BET

echo "--------------------------------------------------------"

dfx identity use kong_user1
echo "Placing bets on each pair for User1"
./place_bet.sh 0 0 $USER1_BET
./place_bet.sh 1 0 $USER1_BET 
./place_bet.sh 2 0 $USER1_BET
./place_bet.sh 3 0 $USER1_BET
./place_bet.sh 4 0 $USER1_BET
./place_bet.sh 5 0 $USER1_BET
./place_bet.sh 6 0 $USER1_BET
./place_bet.sh 7 0 $USER1_BET

echo "--------------------------------------------------------"

dfx identity use kong_user2
echo "Placing bets on each pair for User2"
./place_bet.sh 0 1 $USER2_BET
./place_bet.sh 1 1 $USER2_BET 
./place_bet.sh 2 1 $USER2_BET
./place_bet.sh 3 1 $USER2_BET
./place_bet.sh 4 1 $USER2_BET
./place_bet.sh 5 1 $USER2_BET
./place_bet.sh 6 1 $USER2_BET
./place_bet.sh 7 1 $USER2_BET

dfx identity use default

echo "--------------------------------------------------------"
echo "Balances after bets"
./get_balance.sh
echo "--------------------------------------------------------"
echo "End of bets, waiting for the tournament Resolution to finish"