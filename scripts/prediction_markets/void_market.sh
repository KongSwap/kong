#!/bin/bash

# Void a market by its ID
dfx canister call prediction_markets_backend void_market "($1)"
