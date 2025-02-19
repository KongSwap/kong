#!/bin/bash


echo "--------------------------------------------------------"
echo "01 Creating Kongswap Madness market BOB vs MCDOMS"

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "BOB"; "MCDOMS" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"
echo "02 Creating Kongswap Madness market CLOUD vs PONZI"

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "CLOUD"; "PONZI" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"
echo "03 Creating Kongswap Madness market ELNA vs PANDA"

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "ELNA"; "PANDA" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"
echo "04 Creating Kongswap Madness market EXE vs ALICE"

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "EXE"; "ALICE" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"
echo "05 Creating Kongswap Madness market RAVEN vs DKP"

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "RAVEN"; "DKP" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"
echo "06 Creating Kongswap Madness market WTN vs WELL"

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "WTN"; "WELL" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"
echo "07 Creating Kongswap Madness market ALEX vs CHAT"

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "ALEX"; "CHAT" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"
echo "08 Creating Kongswap Madness market KONG vs AWB" 

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "KONG"; "AWB" },
  variant { Admin },
  variant { Duration = 90 }
)'

echo "--------------------------------------------------------"