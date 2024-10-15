#!/usr/bin/env bash

# will only work on local network

IDENTITY="--identity kong"

dfx deploy ${IDENTITY} internet_identity
