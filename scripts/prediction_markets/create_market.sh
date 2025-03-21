#!/bin/bash

# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness",
#   variant { KongMadness },
#   "Winner by volume",
#   vec { "KONG"; "BOB" },
#   variant { Admin },
#   variant { Duration = 600 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness",
#   variant { KongMadness },
#   "Winner by volume",
#   vec { "KONG"; "BOB" },
#   variant { Admin },
#   variant { Duration = 600 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness",
#   variant { KongMadness },
#   "Winner by volume",
#   vec { "KONG"; "BOB" },
#   variant { Admin },
#   variant { Duration = 600 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness",
#   variant { KongMadness },
#   "Winner by volume",
#   vec { "KONG"; "BOB" },
#   variant { Admin },
#   variant { Duration = 600 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness",
#   variant { KongMadness },
#   "Winner by volume",
#   vec { "KONG"; "BOB" },
#   variant { Admin },
#   variant { Duration = 600 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness",
#   variant { KongMadness },
#   "Winner by volume",
#   vec { "KONG"; "BOB" },
#   variant { Admin },
#   variant { Duration = 600 }
# )'


# dfx canister call prediction_markets_backend create_market '(
#   "Will Trump create Bitcoin reserve in first 100 days?",
#   variant { Crypto },
#   "Market will resolve as a YES if US Government holds Bitcoin in its reserves at any point until April 29,2025 11:59 PM ET",
#   vec { "Yes"; "No" },
#   variant { Admin },
#   variant { Duration = 3601 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Will BTC reach 100k in 2025?",
#   variant { Crypto },
#   "Market closes in 30 days",
#   vec { "Yes"; "No" },
#   variant { Admin },
#   variant { Duration = 180 }
# )'

dfx canister call prediction_markets_backend create_market '(
  "Will BTC reach 100k in 2025?",
  variant { Crypto },
  "Market closes on March 1st, 2025",
  vec { "Yes"; "No" },
  variant { Admin },
  variant { Duration = 3601 },
  null
)'


# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness?",
#   variant { Crypto },
#   "1. Market closes on December 31st, 2025 23:59:59 UTC
#    2. Trading Volume Determines Victory
#    3. The project/token with the highest total trading volume on its designated trading pair during the competition period wins the round
#    4. Volume data will be sourced from our platform’s official metrics https://www.kongswap.io/stats
#    5. Each round begins at 00:00 UTC and ends the next day at 00:00 UTC",
#   vec { "EXE"; "ALICE" },
#   variant { Admin },
#     86400 : nat64
# )'