#!/bin/bash

# First run the build script
bash ./scripts/build_kong_backend.sh local
cargo test -p kong_backend