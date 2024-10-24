#!/usr/bin/env bash

dfx identity new --storage-mode plaintext kong
dfx identity new --storage-mode plaintext kong_token_minter
dfx identity new --storage-mode plaintext kong_user1
dfx identity new --storage-mode plaintext kong_user2