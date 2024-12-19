#!/usr/bin/env bash

# Get network parameter, default to local if not provided
NETWORK=${1:-local}

# Map 'staging' to 'ic' if needed
if [ "${NETWORK}" = "staging" ]; then
    NETWORK="ic"
fi

# Debug output
echo "=============== DEBUG INFO ==============="
echo "Network parameter: ${NETWORK}"
echo "Current directory: $(pwd)"
echo "Available .env files:"
ls -la .env* 2>/dev/null || echo "No .env files found!"
echo "========================================="

# Define source and destination files
SOURCE_FILE="../.env_${NETWORK}"
DEST_FILE="../.env"

echo "Attempting to copy from: $SOURCE_FILE"
echo "Copying to: $DEST_FILE"

# Check if source env file exists and is not empty
if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: Environment file $SOURCE_FILE does not exist"
    exit 1
fi

if [ ! -s "$SOURCE_FILE" ]; then
    echo "Error: Environment file $SOURCE_FILE is empty"
    exit 1
fi

# Copy the environment file with verbose flag
cp -v "$SOURCE_FILE" "$DEST_FILE"
echo "Successfully copied $SOURCE_FILE to $DEST_FILE"

# Verify the copy
if [ -f "$DEST_FILE" ] && [ -s "$DEST_FILE" ]; then
    echo "Verification: .env file exists and is not empty"
    ls -la "$DEST_FILE"
else
    echo "Error: .env file was not created or is empty!"
    exit 1
fi 