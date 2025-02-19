#!/bin/bash

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check if node_modules/.bin path is already in PATH
if [[ ":$PATH:" != *":$PROJECT_ROOT/node_modules/.bin:"* ]]; then
    # Add to zshrc if it doesn't exist
    if ! grep -q "export PATH=\"\$PATH:$PROJECT_ROOT/node_modules/.bin\"" ~/.zshrc; then
        echo "export PATH=\"\$PATH:$PROJECT_ROOT/node_modules/.bin\"" >> ~/.zshrc
        echo "Added kong CLI to PATH in ~/.zshrc"
    else
        echo "kong CLI path already exists in ~/.zshrc"
    fi

    # Also add to current session
    export PATH="$PATH:$PROJECT_ROOT/node_modules/.bin"
    echo "kong CLI is now available in current session"
else
    echo "kong CLI path already in current PATH"
fi

# Verify CLI is accessible
if command -v kong >/dev/null 2>&1; then
    echo "kong CLI is ready to use!"
    echo "Try running: kong --help"
else
    echo "Error: kong CLI not found. Make sure you've run 'npm install' in the project root"
fi 