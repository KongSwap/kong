#!/bin/bash

# dfx canister call prediction_markets_backend create_market '(
#   "Who will win the first round matchup of Kongswap Madness",
#   variant { KongMadness },
#   "Winner by volume",
#   vec { "KONG"; "BOB" },
#   variant { Admin },
#   variant { Duration = 60 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Will BTC reach 100k in 2025?",
#   variant { Crypto },
#   "Market closes in 30 days",
#   vec { "Yes"; "No" },
#   variant { Admin },
#   variant { Duration = 3601 }
# )'

# dfx canister call prediction_markets_backend create_market '(
#   "Will BTC reach 100k in 2025?",
#   variant { Crypto },
#   "Market closes on March 1st, 2025",
#   vec { "Yes"; "No" },
#   variant { Admin },
#   variant { SpecificDate = 1738364400 }
# )'


# dfx canister call prediction_markets_backend create_market '(
#   "Will Bitcoin reach $100k by end of 2025?",
#   variant { Crypto },
#   "1. Market closes on December 31st, 2025 23:59:59 UTC
#    2. Bitcoin price will be determined by the average price across major exchanges (Binance, Coinbase, Kraken)
#    3. Price must maintain above $100,000 for at least 1 hour to be considered valid
#    4. Any market manipulation attempts will result in market cancellation",
#   vec { "Yes"; "No" },
#   variant { Admin },
#     86400 : nat64
# )'

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

dfx canister call prediction_markets_backend create_market '(
  "Who will win the first round matchup of Kongswap Madness",
  variant { KongMadness },
  "Winner by volume",
  vec { "ksKONG"; "ksICP" },
  variant { Admin },
  variant { Duration = 60000 }
)'