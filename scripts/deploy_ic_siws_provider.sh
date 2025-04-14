#!/bin/bash

# Determine the network from the DFINITY_NETWORK environment variable
dfinity_network="${DFINITY_NETWORK:-local}" # Default to local if not set

# Read salt from environment variable, defaulting if not set
siws_salt="${SIWS_SALT:-Dfwdsf31453qegsdq2345eFDasFGSHd}"

# Set domain and URI based on the network
if [ "$dfinity_network" = "ic" ]; then
    domain="kongswap.io"
    uri="https://www.kongswap.io"
    scheme="https"
else
    domain="localhost"
    uri="http://localhost:5173"
    scheme="http"
fi

dfx canister create ic_siws_provider --network $dfinity_network

dfx deploy ic_siws_provider --argument $'(
    record {
        domain = "'"$domain"'";
        uri = "'"$uri"'";
        salt = "'"$siws_salt"'";
        chain_id = opt "mainnet";
        scheme = opt "'"$scheme"'";
        statement = opt "Login to KongSwap";
        sign_in_expires_in = opt 300000000000;
        session_expires_in = opt 604800000000000;
        targets = opt vec {
            "'$(dfx canister id ic_siws_provider --network $dfinity_network)'";
            "'$(dfx canister id kong_backend --network $dfinity_network)'";
            "'$(dfx canister id trollbox --network $dfinity_network)'";
            "'$(dfx canister id prediction_markets_backend --network $dfinity_network)'";
        };
    }
)'