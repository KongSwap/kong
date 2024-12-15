#!/usr/bin/env bash

# can only be for local replica

network="--network local"
identity="--identity kong"
internet_identity="internet_identity"

dfx deploy $identity $internet_identity
