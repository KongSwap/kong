#!/bin/bash

# Default pagination: start at 0, get 100 items
dfx canister call prediction_markets_backend get_markets_by_status '(record { start = 0; length = 100 })'
